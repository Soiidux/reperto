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

const DAY_MS = 24 * 60 * 60 * 1000;

const TEST_USERS: Record<string, { email: string; password: string }> = {
  admin: { email: "test.admin3@reperto.example", password: "Test@12345" },
  staff: { email: "test.staff3@reperto.example", password: "Test@12345" },
  doctor: { email: "test.doctor3@reperto.example", password: "Test@12345" },
  patient: { email: "test.patient4@reperto.example", password: "Test@12345" },
  otherPatient: { email: "test.patient5@reperto.example", password: "Test@12345" },
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
          role: role === "doctor" ? "doctor" : role === "otherPatient" ? "patient" : role,
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
  // This file owns appointment + notification fixtures only.
  await Notification.deleteMany({});
  await Appointment.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

/** Seed a pending appointment for today, defaults to patient × doctor at 09:15. */
const makeAppointment = async (overrides: Record<string, unknown> = {}) =>
  Appointment.create({
    patientId: userIds.patient,
    doctorId: userIds.doctor,
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

const updateStatus = (
  id: unknown,
  status: string,
  token: string,
  cancellationReason?: string,
) =>
  request(app)
    .patch(`/api/appointment/${id}/status`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status, cancellationReason });

describe("front-desk status editing", () => {
  it("lets staff move a booking through any status", async () => {
    const appointment = await makeAppointment();

    for (const status of ["completed", "cancelled", "pending", "no-show", "arrived"]) {
      const res = await updateStatus(appointment._id, status, tokens.staff);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
    }
  });

  it("stamps who checked a patient in and clears it when reopened", async () => {
    const appointment = await makeAppointment();

    await updateStatus(appointment._id, "arrived", tokens.staff);
    let stored = await Appointment.findById(appointment._id);
    expect(stored!.checkedInAt).toBeInstanceOf(Date);
    expect(stored!.checkedInBy?.toString()).toBe(userIds.staff);

    await updateStatus(appointment._id, "pending", tokens.staff);
    stored = await Appointment.findById(appointment._id);
    expect(stored!.checkedInAt).toBeNull();
    expect(stored!.checkedInBy).toBeNull();
  });

  it("clears the cancellation reason when a booking is reopened", async () => {
    const appointment = await makeAppointment();
    await updateStatus(appointment._id, "cancelled", tokens.staff, "No reason given");

    let stored = await Appointment.findById(appointment._id);
    expect(stored!.cancellationReason).toBe("No reason given");

    await updateStatus(appointment._id, "pending", tokens.staff);
    stored = await Appointment.findById(appointment._id);
    expect(stored!.status).toBe("pending");
    expect(stored!.cancellationReason).toBe("");
  });

  it("blocks doctors from changing status", async () => {
    const appointment = await makeAppointment();
    const res = await updateStatus(appointment._id, "arrived", tokens.doctor);
    expect(res.status).toBe(403);
    const stored = await Appointment.findById(appointment._id);
    expect(stored!.status).toBe("pending");
  });

  it("lets patients cancel their own booking but nothing else", async () => {
    // Booked for tomorrow so the cancellation window never blocks the test.
    const tomorrow = new Date(getClinicTodayAnchor().getTime() + DAY_MS);
    const appointment = await makeAppointment({ appointmentDate: tomorrow });

    const cannotArrive = await updateStatus(appointment._id, "arrived", tokens.patient);
    expect(cannotArrive.status).toBe(403);

    const notMine = await updateStatus(appointment._id, "cancelled", tokens.otherPatient, "nope");
    expect(notMine.status).toBe(403);

    const cancelled = await updateStatus(
      appointment._id,
      "cancelled",
      tokens.patient,
      "Feeling better",
    );
    expect(cancelled.status).toBe(200);
    const stored = await Appointment.findById(appointment._id);
    expect(stored!.status).toBe("cancelled");
    expect(stored!.cancellationReason).toBe("Feeling better");
  });

  it("returns 409 when reopening a cancelled booking whose slot was rebooked", async () => {
    const cancelled = await makeAppointment();
    await updateStatus(cancelled._id, "cancelled", tokens.staff);

    // A different patient takes the slot that cancelling freed.
    await makeAppointment({ patientId: userIds.otherPatient });

    const reopen = await updateStatus(cancelled._id, "pending", tokens.staff);
    expect(reopen.status).toBe(409);
  });

  it("rejects an unknown status", async () => {
    const appointment = await makeAppointment();
    const res = await updateStatus(appointment._id, "teleported", tokens.staff);
    expect(res.status).toBe(400);
  });
});

describe("today queue population", () => {
  it("populates doctor and check-in auditor names for staff/admin", async () => {
    const appointment = await makeAppointment();
    await updateStatus(appointment._id, "arrived", tokens.staff);

    for (const token of [tokens.staff, tokens.admin]) {
      const res = await request(app)
        .get("/api/appointment/today")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);

      const listed = res.body.data.appointments.find(
        (a: any) => a._id.toString() === appointment._id.toString(),
      );
      expect(listed).toBeDefined();
      expect(listed.doctorId.name).toBe("Test doctor");
      expect(listed.checkedInBy.name).toBe("Test staff");
    }
  });
});

describe("check-in notification dedupe", () => {
  const arrivedTitles = () =>
    Notification.countDocuments({
      recipientId: userIds.patient,
      title: "You've checked in",
    });

  it("does not repeat the check-in notice for idempotent or reopen cycles", async () => {
    const appointment = await makeAppointment();

    await updateStatus(appointment._id, "arrived", tokens.staff);
    expect(await arrivedTitles()).toBe(1);

    // Idempotent re-edit while already arrived → no extra notice.
    await updateStatus(appointment._id, "arrived", tokens.staff);
    expect(await arrivedTitles()).toBe(1);

    // Reopen → arrive again while the twin is still unread → still deduped.
    await updateStatus(appointment._id, "pending", tokens.staff);
    await updateStatus(appointment._id, "arrived", tokens.staff);
    expect(await arrivedTitles()).toBe(1);
  });

  it("sends a fresh check-in notice once the previous one has been read", async () => {
    const appointment = await makeAppointment();

    await updateStatus(appointment._id, "arrived", tokens.staff);
    const prior = await Notification.findOne({
      recipientId: userIds.patient,
      title: "You've checked in",
    });
    await Notification.updateOne(
      { _id: prior!._id },
      { $set: { readAt: new Date() } },
    );

    await updateStatus(appointment._id, "pending", tokens.staff);
    await updateStatus(appointment._id, "arrived", tokens.staff);

    expect(await arrivedTitles()).toBe(2);
  });
});