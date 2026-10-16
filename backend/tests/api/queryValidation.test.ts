import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import app from "../../src/app";
import User from "../../src/db/models/user.model";
import ClinicSettings from "../../src/db/models/clinicSettings.model";
import { buildDefaultSettings } from "../../src/utils/clinicSettings";

/**
 * Query-string validation.
 *
 * Before this, every query parameter in the API was described in the OpenAPI
 * document and never checked — the document carried
 * `x-query-params-documented-only` on 17 operations as an honest admission of
 * that. The schemas in zodQuerySchemas.ts are now enforced at runtime *and*
 * published, from one definition.
 *
 * Two things make this suite more than a restatement of the schemas:
 *
 *   1. The compatibility cases. Turning validation on changes which requests
 *      succeed, so the shapes that used to work and must keep working are
 *      pinned explicitly — `limit=0`, `?search=`, `?status=all`.
 *   2. The improvements. A handful of inputs are now rejected that used to be
 *      silently coerced into something misleading, and each of those is a
 *      deliberate change rather than an accident.
 */

const PASS = "Test@12345";
const ACCOUNTS = {
  patient: { email: "query.patient@reperto.example" },
  doctor: { email: "query.doctor@reperto.example" },
  staff: { email: "query.staff@reperto.example" },
  admin: { email: "query.admin@reperto.example" },
} as const;

const tokens: Record<string, string> = {};

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  for (const [role, { email }] of Object.entries(ACCOUNTS)) {
    await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          name: `Query ${role}`,
          email,
          password: await bcrypt.hash(PASS, 10),
          phone: `9550000${role.length}`,
          gender: "other",
          dateOfBirth: new Date("1990-01-01"),
          bloodGroup: "O+",
          role,
          accountType: "self",
          isActive: true,
          emailVerified: true,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: PASS });
    tokens[role] = login.body.data.accessToken;
  }

  if (!(await ClinicSettings.findOne())) {
    await ClinicSettings.create(buildDefaultSettings());
  }
});

afterAll(async () => {
  await mongoose.disconnect();
});

const get = (role: string, path: string) =>
  request(app).get(path).set("Authorization", `Bearer ${tokens[role]}`);

/** A rejected query names the source, so a client knows which half was wrong. */
const expectRejected = async (res: { status: number; body: any }, field: string) => {
  expect(res.status).toBe(400);
  expect(res.body.success).toBe(false);
  expect(res.body.source).toBe("query");
  expect(res.body.errors[field], `expected an error on ${field}`).toBeDefined();
};

describe("query validation is enforced", () => {
  it("rejects a non-numeric page", async () => {
    await expectRejected(await get("patient", "/api/v1/appointment?page=abc"), "page");
  });

  it("rejects page zero", async () => {
    await expectRejected(await get("patient", "/api/v1/appointment?page=0"), "page");
  });

  it("rejects an unknown appointment status", async () => {
    await expectRejected(
      await get("patient", "/api/v1/appointment?status=sideways"),
      "status",
    );
  });

  it("rejects a malformed date range", async () => {
    await expectRejected(
      await get("patient", "/api/v1/appointment?from=20-10-2026"),
      "from",
    );
    // Format-valid but not a real date. The schema only checks the shape;
    // parseDateAnchor rejects impossible dates, which is where that rule lives.
    const impossible = await get("patient", "/api/v1/appointment?to=2026-13-45");
    expect(impossible.status).toBe(400);
    expect(impossible.body.message).toMatch(/invalid/i);
  });

  it("requires doctorId and date for slot lookups", async () => {
    await expectRejected(await get("patient", "/api/v1/appointment/slots"), "doctorId");
    await expectRejected(
      await get("patient", `/api/v1/appointment/slots?doctorId=${"0".repeat(24)}`),
      "date",
    );
  });

  it("requires a valid ObjectId-shaped doctorId", async () => {
    await expectRejected(
      await get("patient", "/api/v1/appointment/slots?doctorId=abc&date=2026-12-01"),
      "doctorId",
    );
  });

  it("requires patientId when listing reports", async () => {
    await expectRejected(await get("patient", "/api/v1/report"), "patientId");
    await expectRejected(await get("patient", "/api/v1/report?patientId=nope"), "patientId");
  });

  it("rejects an unknown audit resource or action", async () => {
    await expectRejected(
      await get("admin", "/api/v1/admin/audit/activity?resource=everything"),
      "resource",
    );
    await expectRejected(
      await get("admin", "/api/v1/admin/audit/activity?action=exfiltrate"),
      "action",
    );
  });

  it("rejects a malformed audit actorId", async () => {
    await expectRejected(
      await get("admin", "/api/v1/admin/audit/activity?actorId=not-an-id"),
      "actorId",
    );
  });

  it("rejects an unknown arrived scope", async () => {
    await expectRejected(
      await get("staff", "/api/v1/appointment/arrived?scope=forever"),
      "scope",
    );
  });
});

describe("inputs that used to be silently coerced still work", () => {
  // These are the compatibility cases. Turning validation on must not break a
  // request that the API already answered.
  it("accepts limit=0, which controllers read as 'use the default'", async () => {
    const res = await get("patient", "/api/v1/appointment?limit=0");
    expect(res.status).toBe(200);
  });

  it("accepts an empty search as 'no filter'", async () => {
    // The directory requires patients:list (doctor/staff/admin), not a patient.
    const res = await get("doctor", "/api/v1/user/patients?search=");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("accepts the sentinel the SPA sends for 'no filter'", async () => {
    for (const query of [
      "/api/v1/appointment?status=all",
      "/api/v1/admin/users?role=all&isActive=all",
    ]) {
      const res = await get("admin", query);
      expect(res.status, query).toBe(200);
    }
  });

  it("accepts an absent query string entirely", async () => {
    for (const path of [
      "/api/v1/appointment",
      "/api/v1/appointment/today",
      "/api/v1/notification",
      "/api/v1/user/patients",
      "/api/v1/user/doctors",
      "/api/v1/admin/users",
      "/api/v1/admin/clinic-blockouts",
    ]) {
      const res = await get("admin", path);
      expect(res.status, path).toBe(200);
    }
  });

  it("accepts a well-formed query on every validated endpoint", async () => {
    const requests: [string, string][] = [
      ["patient", `/api/v1/appointment?page=1&limit=10&status=pending&from=2026-01-01&to=2026-12-31&search=jo`],
      ["patient", "/api/v1/appointment/today?limit=5"],
      ["patient", "/api/v1/appointment/active?limit=5"],
      ["staff", "/api/v1/appointment/arrived?scope=today&limit=5"],
      ["patient", `/api/v1/appointment/slots?doctorId=${"0".repeat(24)}&date=2026-12-01&durationInMinutes=15`],
      ["patient", `/api/v1/appointment/available-slots?doctorId=${"0".repeat(24)}&date=2026-12-01`],
      ["patient", "/api/v1/notification?limit=10"],
      ["patient", "/api/v1/user/doctors?specialization=Homeopathy&name=dr"],
      ["doctor", "/api/v1/user/patients?page=1&limit=10&search=a"],
      ["patient", `/api/v1/review?doctorId=${"0".repeat(24)}`],
      ["patient", `/api/v1/report?patientId=${"0".repeat(24)}`],
      ["doctor", "/api/v1/consultation/follow-ups?status=pending"],
      ["admin", "/api/v1/admin/users?page=1&limit=10&search=dr&role=doctor&isActive=true"],
      ["admin", "/api/v1/admin/audit/activity?action=read&resource=report&limit=20"],
      ["admin", "/api/v1/admin/clinic-blockouts?from=2026-01-01&to=2026-12-31"],
    ];
    for (const [role, path] of requests) {
      const res = await get(role, path);
      // Some of these legitimately 4xx for data reasons (unknown ids); what
      // matters is that the query string itself was accepted.
      expect(res.status, `${path} -> ${res.body?.message ?? ""}`).not.toBe(400);
    }
  });
});

describe("two behaviours are now stricter, on purpose", () => {
  it("rejects an unrecognised isActive instead of meaning 'inactive only'", async () => {
    // Previously `?isActive=yes` failed every `=== "true"` comparison, so the
    // endpoint returned only deactivated accounts and looked like an empty
    // directory. A 400 says what actually went wrong.
    await expectRejected(
      await get("admin", "/api/v1/admin/users?isActive=yes"),
      "isActive",
    );
  });

  it("rejects an unrecognised role", async () => {
    await expectRejected(
      await get("admin", "/api/v1/admin/users?role=superuser"),
      "role",
    );
  });
});

describe("query validation does not shadow authorization", () => {
  it("still refuses an anonymous caller before validating", async () => {
    const res = await request(app).get("/api/v1/appointment?page=1");
    // protect runs before validate, so a bad token is a 401 rather than a
    // lecture about the query string.
    expect(res.status).toBe(401);
  });

  it("still refuses a role without the capability", async () => {
    const res = await get("patient", "/api/v1/admin/users?page=1");
    expect(res.status).toBe(403);
  });
});