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
import ClinicSettings from "../../src/db/models/clinicSettings.model";
import { buildDefaultSettings } from "../../src/utils/clinicSettings";
import { getClinicTodayAnchor } from "../../src/utils/clinicDate";

/**
 * Pagination is the one place where a missing default is a real incident
 * rather than a nuisance: `GET /appointment` used to treat `limit=0` (the
 * default) as "no limit", so a caller that simply omitted `?limit` received the
 * entire appointments collection. Appointment history is the biggest table in
 * a clinic, and the frontend's agenda view calls it with only a date range.
 */

const ADMIN = { email: "page.admin@reperto.example", password: "Test@12345" };
const DOCTOR = { email: "page.doctor@reperto.example", password: "Test@12345" };
const PATIENT = { email: "page.patient@reperto.example", password: "Test@12345" };

const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  for (const [key, { email, password }] of Object.entries({
    admin: ADMIN,
    doctor: DOCTOR,
    patient: PATIENT,
  })) {
    const user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          name: `Paging ${key}`,
          email,
          password: await bcrypt.hash(password, 10),
          phone: `9700000${key.length}`,
          gender: "other",
          dateOfBirth: new Date("1990-01-01"),
          bloodGroup: "O+",
          role: key === "patient" ? "patient" : key,
          accountType: "self",
          isActive: true,
          emailVerified: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    ids[key] = user!._id.toString();

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    tokens[key] = login.body.data.accessToken;
  }

  if (!(await ClinicSettings.findOne())) {
    await ClinicSettings.create(buildDefaultSettings());
  }
});

beforeEach(async () => {
  await Appointment.deleteMany({ patientId: ids.patient });
});

afterAll(async () => {
  await mongoose.disconnect();
});

/** `count` appointments for this fixture patient, spread across past days. */
const seed = async (count: number) => {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const base = getClinicTodayAnchor().getTime();
  await Appointment.insertMany(
    Array.from({ length: count }, (_, i) => ({
      patientId: ids.patient,
      doctorId: ids.doctor,
      // Distinct days so no slot collision, all in the past.
      appointmentDate: new Date(base - (i + 2) * DAY_MS),
      timeSlot: "09:00",
      durationInMinutes: 15,
      status: "completed",
      consultationType: "Initial",
      intakeDetails: {
        primaryComplaint: "Paging fixture",
        duration: "1 week",
        currentMedication: "None",
        pastMedicalHistory: "Nil significant",
      },
    })),
  );
};

const list = (query: string) =>
  request(app)
    .get(`/api/v1/appointment?${query}`)
    .set("Authorization", `Bearer ${tokens.patient}`);

describe("GET /appointment pagination", () => {
  it("does not return the whole collection when limit is omitted", async () => {
    await seed(60);
    const res = await list("");
    expect(res.status).toBe(200);
    // The defect: every row came back. The fix: a bounded default page.
    expect(res.body.data.count).toBeLessThanOrEqual(50);
    expect(res.body.data.pagination.totalItems).toBe(60);
    expect(res.body.data.pagination.hasNextPage).toBe(true);
  });

  it("treats an explicit limit of 0 as the default, not as unlimited", async () => {
    await seed(60);
    const res = await list("limit=0");
    expect(res.body.data.count).toBeLessThanOrEqual(50);
  });

  it("caps a caller asking for everything", async () => {
    await seed(60);
    const res = await list("limit=100000");
    // Hard ceiling, so one request cannot ask the database for the whole table.
    expect(res.body.data.count).toBeLessThanOrEqual(200);
  });

  it("honours an explicit page size", async () => {
    await seed(60);
    const res = await list("limit=10");
    expect(res.body.data.count).toBe(10);
    expect(res.body.data.pagination.totalPages).toBe(6);
    expect(res.body.data.pagination.hasNextPage).toBe(true);
    expect(res.body.data.pagination.hasPrevPage).toBe(false);
  });

  it("walks pages without repeating or dropping a row", async () => {
    await seed(60);
    const first = await list("limit=25&page=1");
    const second = await list("limit=25&page=2");
    const third = await list("limit=25&page=3");

    expect(first.body.data.count).toBe(25);
    expect(second.body.data.count).toBe(25);
    expect(third.body.data.count).toBe(10);

    const ids = [
      ...first.body.data.appointments,
      ...second.body.data.appointments,
      ...third.body.data.appointments,
    ].map((a: { _id: string }) => a._id);
    expect(new Set(ids).size).toBe(60);
  });

  it("reports pagination arithmetic that matches the page size", async () => {
    await seed(60);
    const res = await list("limit=25");
    const p = res.body.data.pagination;
    // The defect made totalPages divide by max(limit, 1), so 15 rows at limit 0
    // reported as 15 pages of one. It must now follow the real page size.
    expect(p.totalPages).toBe(Math.ceil(60 / 25));
    expect(p.hasNextPage).toBe(true);
    expect(p.hasPrevPage).toBe(false);
  });

  it("survives a page past the end without erroring", async () => {
    await seed(5);
    const res = await list("limit=25&page=99");
    expect(res.status).toBe(200);
    expect(res.body.data.count).toBe(0);
    expect(res.body.data.pagination.hasNextPage).toBe(false);
  });

  it("never reports fewer than one page for an empty result", async () => {
    const res = await list("limit=25");
    expect(res.body.data.pagination.totalItems).toBe(0);
    expect(res.body.data.pagination.totalPages).toBe(1);
  });

  it("rejects a nonsensical page rather than returning nonsense", async () => {
    await seed(5);
    const res = await list("limit=25&page=0");
    expect(res.status).toBe(200);
    // page=0 would compute a negative skip; it is clamped to the first page.
    expect(res.body.data.pagination.currentPage).toBe(1);
  });
});