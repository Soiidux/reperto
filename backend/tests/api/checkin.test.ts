import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import app from "../../src/app";
import User from "../../src/db/models/user.model";
import Appointment from "../../src/db/models/appointment.model";
import Notification from "../../src/db/models/notification.model";
import { getClinicTodayAnchor } from "../../src/utils/clinicDate";
import { ticketRef } from "../../src/utils/ticket";

const DAY_MS = 24 * 60 * 60 * 1000;

const TEST_USERS: Record<string, { email: string; password: string }> = {
  admin: { email: "test.admin2@reperto.example", password: "Test@12345" },
  staff: { email: "test.staff2@reperto.example", password: "Test@12345" },
  doctor1: { email: "test.doctor1@reperto.example", password: "Test@12345" },
  doctor2: { email: "test.doctor2@reperto.example", password: "Test@12345" },
  patient: { email: "test.patient2@reperto.example", password: "Test@12345" },
  patient2: { email: "test.patient3@reperto.example", password: "Test@12345" },
};

const tokens: Record<string, string> = {};
const userIds: Record<string, string> = {};

const login = async (role: keyof typeof TEST_USERS): Promise<string> => {
  const res = await request(app).post("/api/auth/login").send({
    email: TEST_USERS[role].email,
    password: TEST_USERS[role].password,
  });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
};

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set — the vitest config must point tests at a dedicated database");
  }
  await mongoose.connect(uri);

  for (const role of Object.keys(TEST_USERS) as (keyof typeof TEST_USERS)[]) {
    const { email, password } = TEST_USERS[role];
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          name: `Test ${role}`,
          email,
          password: hashed,
          phone: "9999999999",
          gender: "other",
          dateOfBirth: new Date("1990-01-01"),
          bloodGroup: "O+",
          // Map the fixture key onto a real role. Falling through with the key
          // itself wrote the literal string "patient2" into `role`, which is not
          // a valid role: it leaked into the shared test database and broke any
          // other suite that asserted on the user directory.
          role: role.startsWith("doctor")
            ? "doctor"
            : role.startsWith("patient")
              ? "patient"
              : role,
          accountType: "self",
          isActive: true,
          emailVerified: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    userIds[role] = user!._id.toString();
  }

  for (const role of Object.keys(TEST_USERS) as (keyof typeof TEST_USERS)[]) {
    tokens[role] = await login(role);
  }
});

beforeEach(async () => {
  // This file owns appointment + notification fixtures only (the clinic files
  // own settings/blockouts); scoped cleanup keeps the shared test DB stable
  // even while other API files are running.
  await Notification.deleteMany({});
  await Appointment.deleteMany({});
});

afterAll(async () => {
  // The test database is dropped once in tests/globalSetup.ts; each file only
  // disconnects. Dropping here raced with other suites' fixtures.
  await mongoose.disconnect();
});

/** Seed a pending appointment for today, defaults to patient × doctor1 at 09:15. */
const makeAppointment = async (overrides: Record<string, unknown> = {}) => {
  const appointment = await Appointment.create({
    patientId: userIds.patient,
    doctorId: userIds.doctor1,
    appointmentDate: getClinicTodayAnchor(),
    timeSlot: "09:15",
    durationInMinutes: 15,
    status: "pending",
    consultationType: "Initial",
    intakeDetails: {
      primaryComplaint: "Test complaint",
      duration: "2 weeks",
      currentMedication: "",
      pastMedicalHistory: "",
    },
    ...overrides,
  });
  return appointment;
};

const checkIn = (code: string, token: string) =>
  request(app)
    .post("/api/appointment/check-in")
    .set("Authorization", `Bearer ${token}`)
    .send({ code });

describe("reception ticket check-in", () => {
  it("checks a scanned ticket in as staff and notifies the patient", async () => {
    const appointment = await makeAppointment();
    const code = ticketRef(appointment);

    const res = await checkIn(code, tokens.staff);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.alreadyCheckedIn).toBe(false);
    expect(data.appointment.status).toBe("arrived");
    expect(data.appointment.patient.name).toBe("Test patient");
    expect(data.appointment.doctor.name).toBe("Test doctor1");
    expect(data.appointment.timeSlot).toBe("09:15");

    const stored = await Appointment.findById(appointment._id);
    expect(stored!.status).toBe("arrived");
    // Check-in audit records who did it.
    expect(stored!.checkedInAt).toBeInstanceOf(Date);
    expect(stored!.checkedInBy?.toString()).toBe(userIds.staff);

    const notice = await Notification.countDocuments({
      recipientId: userIds.patient,
      type: "appointment-status",
      title: "You've checked in",
    });
    expect(notice).toBe(1);
  });

  it("is idempotent — a second scan reports the patient was already checked in", async () => {
    const appointment = await makeAppointment();
    const code = ticketRef(appointment);

    await checkIn(code, tokens.staff);
    const second = await checkIn(code, tokens.staff);
    expect(second.status).toBe(200);
    expect(second.body.data.alreadyCheckedIn).toBe(true);
    expect(second.body.data.appointment.status).toBe("arrived");
    // No duplicate notification fan-out.
    const notice = await Notification.countDocuments({
      recipientId: userIds.patient,
      type: "appointment-status",
      title: "You've checked in",
    });
    expect(notice).toBe(1);
  });

  it("lets an admin check in, but blocks doctors (front-desk only)", async () => {
    const appointment = await makeAppointment();
    const code = ticketRef(appointment);

    const byDoctor = await checkIn(code, tokens.doctor1);
    expect(byDoctor.status).toBe(403);

    const byAdmin = await checkIn(code, tokens.admin);
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body.data.appointment.status).toBe("arrived");
  });

  it("rejects patients and doctors (front-desk only)", async () => {
    const appointment = await makeAppointment();
    const code = ticketRef(appointment);

    const asPatient = await checkIn(code, tokens.patient);
    expect(asPatient.status).toBe(403);

    const asOtherDoctor = await checkIn(code, tokens.doctor2);
    expect(asOtherDoctor.status).toBe(403);
  });

  it("allows staff to check in patients booked under another doctor", async () => {
    const appointment = await makeAppointment({ timeSlot: "10:00", doctorId: userIds.doctor2 });
    const res = await checkIn(ticketRef(appointment), tokens.staff);
    expect(res.status).toBe(200);
    expect(res.body.data.appointment.status).toBe("arrived");
  });

  it("rejects tickets for appointments that are not today", async () => {
    const tomorrow = new Date(getClinicTodayAnchor().getTime() + DAY_MS);
    const appointment = await makeAppointment({ appointmentDate: tomorrow });
    const res = await checkIn(ticketRef(appointment), tokens.staff);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("isn't today");
    const stored = await Appointment.findById(appointment._id);
    expect(stored!.status).toBe("pending");
  });

  it("rejects malformed or unrecognized ticket codes", async () => {
    const malformed = await checkIn("not-a-ticket", tokens.staff);
    expect(malformed.status).toBe(400);

    // Well-formed structure but an appointment id that matches nothing.
    const ghostId = new mongoose.Types.ObjectId().toString();
    const unknown = await checkIn(
      `REPERTO_TICKET:${ghostId}:21-Sept-2026:09:00`,
      tokens.staff,
    );
    expect(unknown.status).toBe(404);
  });

  it("rejects check-in for appointments that are past check-in", async () => {
    const statuses = ["completed", "cancelled", "no-show"];
    const slots = ["09:15", "09:30", "09:45"];
    for (let i = 0; i < statuses.length; i += 1) {
      const appointment = await makeAppointment({ status: statuses[i], timeSlot: slots[i] });
      const res = await checkIn(ticketRef(appointment), tokens.staff);
      expect(res.status).toBe(409);
      expect(res.body.message).toContain(statuses[i]);
    }
  });
});