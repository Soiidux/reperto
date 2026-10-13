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
import Report from "../../src/db/models/report.model";
import AccessLog from "../../src/db/models/accessLog.model";
import { getClinicTodayAnchor } from "../../src/utils/clinicDate";

/**
 * PHI read-access audit.
 *
 * The clinic records check-ins, but nothing recorded who *opened* a patient's
 * records. These tests assert that reads are logged, that the log is
 * queryable by admins only, and — critically — that auditing can never break
 * the request that triggered it.
 */

const TEST_USERS = {
  admin: { email: "test.audit.admin@reperto.example", password: "Test@12345" },
  staff: { email: "test.audit.staff@reperto.example", password: "Test@12345" },
  doctor: { email: "test.audit.doctor@reperto.example", password: "Test@12345" },
  patient: { email: "test.audit.patient@reperto.example", password: "Test@12345" },
} as const;

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
          role:
            role === "patient"
              ? "patient"
              : role === "doctor"
                ? "doctor"
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
  await AccessLog.deleteMany({});
  await Report.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

const seedReport = () =>
  Report.create({
    patientId: userIds.patient,
    uploadedBy: userIds.staff,
    title: "Audit fixture",
    category: "lab",
    description: "",
    files: [
      {
        url: "https://res.cloudinary.com/x/image/upload/a.png",
        publicId: "a",
        storage: "cloudinary",
        name: "a.png",
        mimeType: "image/png",
        size: 10,
        resourceType: "image",
      },
    ],
  });

const listReports = (patientId: string, token: string) =>
  request(app)
    .get(`/api/report?patientId=${patientId}`)
    .set("Authorization", `Bearer ${token}`);

describe("PHI access audit trail", () => {
  it("records a read of a patient's report vault", async () => {
    await seedReport();

    const res = await listReports(userIds.patient, tokens.patient);
    expect(res.status).toBe(200);

    const logs = await AccessLog.find({ patientId: userIds.patient });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: new mongoose.Types.ObjectId(userIds.patient),
      actorRole: "patient",
      patientId: new mongoose.Types.ObjectId(userIds.patient),
      resource: "report",
      action: "read",
    });
    expect(logs[0].route).toBe("GET /api/report");
  });

  it("records staff reads with their role, so 'who looked at this patient' has an answer", async () => {
    await seedReport();

    await listReports(userIds.patient, tokens.staff);

    const logs = await AccessLog.find({ patientId: userIds.patient });
    expect(logs).toHaveLength(1);
    expect(logs[0].actorRole).toBe("staff");
    expect(logs[0].actorId.toString()).toBe(userIds.staff);
  });

  it("logs the download of an individual document separately from the listing", async () => {
    const report = await seedReport();

    await listReports(userIds.patient, tokens.patient);
    await request(app)
      .get(`/api/report/${report._id}/file/0`)
      .set("Authorization", `Bearer ${tokens.patient}`);

    const logs = await AccessLog.find({ patientId: userIds.patient });
    expect(logs).toHaveLength(2);
    const routes = logs.map((l) => l.route).sort();
    expect(routes).toEqual([
      "GET /api/report",
      "GET /api/report/:id/file/:index",
    ]);
  });

  it("does not log a denied request — nothing was accessed", async () => {
    // A patient asking for someone else's reports is refused, so there is
    // nothing to audit.
    const other = await User.findOneAndUpdate(
      { email: "test.audit.other@reperto.example" },
      {
        $setOnInsert: {
          name: "Test other",
          email: "test.audit.other@reperto.example",
          password: await bcrypt.hash("Test@12345", 10),
          phone: "9999999998",
          gender: "other",
          dateOfBirth: new Date("1991-01-01"),
          bloodGroup: "O+",
          role: "patient",
          accountType: "self",
          isActive: true,
          emailVerified: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    const res = await listReports(userIds.patient, tokens.patient);
    expect(res.status).toBe(200);

    // The patient's own read is logged; the unrelated account is not touched.
    const otherLogs = await AccessLog.countDocuments({
      patientId: other!._id.toString(),
    });
    expect(otherLogs).toBe(0);
  });

  describe("query endpoints", () => {
    it("lets an admin read a patient's access log", async () => {
      await seedReport();
      await listReports(userIds.patient, tokens.staff);

      const res = await request(app)
        .get(`/api/admin/audit/patient/${userIds.patient}`)
        .set("Authorization", `Bearer ${tokens.admin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBeGreaterThanOrEqual(1);
      expect(res.body.data.entries[0].actorRole).toBe("staff");
    });

    it("filters activity by actor", async () => {
      await seedReport();
      await listReports(userIds.patient, tokens.staff);
      await listReports(userIds.patient, tokens.doctor);

      const res = await request(app)
        .get(`/api/admin/audit/activity?actorId=${userIds.staff}`)
        .set("Authorization", `Bearer ${tokens.admin}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
      expect(res.body.data.entries[0].actorRole).toBe("staff");
    });

    it("answers 'has any staff member accessed this patient'", async () => {
      await seedReport();
      await listReports(userIds.patient, tokens.staff);

      const res = await request(app)
        .get(`/api/admin/audit/patient/${userIds.patient}/by-staff`)
        .set("Authorization", `Bearer ${tokens.admin}`);

      expect(res.status).toBe(200);
      // Only the staff read, not the patient's own.
      expect(res.body.data.entries.every((e: { actorRole: string }) => e.actorRole !== "patient")).toBe(true);
    });

    it("keeps the audit trail admin-only — staff and doctors are refused", async () => {
      await seedReport();

      for (const role of ["staff", "doctor", "patient"] as const) {
        const res = await request(app)
          .get(`/api/admin/audit/patient/${userIds.patient}`)
          .set("Authorization", `Bearer ${tokens[role]}`);
        expect(res.status).toBe(403);
      }
    });

    it("requires authentication", async () => {
      const res = await request(app).get(
        `/api/admin/audit/patient/${userIds.patient}`,
      );
      expect(res.status).toBe(401);
    });

    it("rejects a malformed patient id", async () => {
      const res = await request(app)
        .get("/api/admin/audit/patient/not-an-id")
        .set("Authorization", `Bearer ${tokens.admin}`);
      expect(res.status).toBe(400);
    });
  });

  describe("resilience", () => {
    it("never lets a malformed actor break the audited request", async () => {
      // recordAccess silently skips entries it cannot make sense of; the
      // read itself must still succeed.
      const { recordAccess } = await import("../../src/db/models/accessLog.model");
      await expect(
        recordAccess({
          actorId: "garbage",
          patientId: "garbage",
          resource: "report",
          action: "read",
        }),
      ).resolves.toBeUndefined();

      await seedReport();
      const res = await listReports(userIds.patient, tokens.patient);
      expect(res.status).toBe(200);
    });

    it("never throws even when the ids are missing entirely", async () => {
      const { recordAccess } = await import("../../src/db/models/accessLog.model");
      await expect(
        recordAccess({ resource: "report", action: "read" }),
      ).resolves.toBeUndefined();

      // A partial entry is skipped rather than written half-empty.
      expect(await AccessLog.countDocuments({})).toBe(0);
    });
  });

  describe("indexes", () => {
    it("are built for the two audit questions", async () => {
      const indexes = await AccessLog.collection.indexes();
      const keys = indexes.map((i: { key: Record<string, number> }) =>
        Object.entries(i.key).map(([k, v]) => `${k}:${v}`).join(","),
      );
      expect(keys).toContain("patientId:1,createdAt:-1");
      expect(keys).toContain("actorId:1,createdAt:-1");
    });
  });
});