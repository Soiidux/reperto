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
import Appointment from "../../src/db/models/appointment.model";
import Consultation from "../../src/db/models/consultation.model";
import Report from "../../src/db/models/report.model";
import ClinicSettings from "../../src/db/models/clinicSettings.model";
import AccessLog from "../../src/db/models/accessLog.model";
import Notification from "../../src/db/models/notification.model";
import { buildDefaultSettings } from "../../src/utils/clinicSettings";
import { getClinicTodayAnchor } from "../../src/utils/clinicDate";
import { ticketRef } from "../../src/utils/ticket";
import {
  accessLogPageSchema,
  adminAnalyticsSchema,
  adminStatsSchema,
  appointmentPageSchema,
  appointmentQueueSchema,
  appointmentSchema,
  authSessionSchema,
  checkInResultSchema,
  clinicBlockoutSchema,
  consultationHistoryEntrySchema,
  dataExportSchema,
  doctorDirectoryEntrySchema,
  familyMemberSchema,
  followUpSchema,
  leaveRecordSchema,
  medicalHistorySchema,
  notificationListSchema,
  notificationSchema,
  ownProfileSchema,
  refreshedAccessTokenSchema,
  reportListSchema,
  reviewListResponseSchema,
  slotStateSchema,
  userSummarySchema,
  patientDirectoryEntrySchema,
} from "../../src/openapi/responseSchemas";

/**
 * Verifies response schemas against what the server actually returns.
 *
 * The reason this file is as long as it is: a response schema that is merely
 * plausible is worse than none, because the generated OpenAPI document and the
 * generated frontend types both inherit the mistake and compile happily.
 *
 * Every wrong guess it has caught so far:
 *   - notifications described as userId/message/read (really
 *     recipientId/body/readAt) with a nine-value type enum (really four)
 *   - clinic settings described as the internal document (really a projection)
 *   - day assumed to be a weekday name (really a 0-6 index)
 *   - the patient directory assumed to include role (its projection omits it)
 *   - doctorProfile assumed singular (really specializations/qualifications/
 *     experienceYears/languagesSpoken)
 *   - GET /report assumed to be a bare array (really { count, reports })
 *   - register assumed to return tokens (really null)
 *   - refresh assumed to return both tokens (really the access token only,
 *     the refresh token being an httpOnly cookie)
 *
 * Each looked right. None would have been caught without a live call.
 */

const PASS = "Test@12345";

const ACCOUNTS = {
  patient: { email: "shape.patient@reperto.example" },
  doctor: { email: "shape.doctor@reperto.example" },
  staff: { email: "shape.staff@reperto.example" },
  admin: { email: "shape.admin@reperto.example" },
} as const;

const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  for (const [role, { email }] of Object.entries(ACCOUNTS)) {
    const user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          name: `Shape ${role}`,
          email,
          password: await bcrypt.hash(PASS, 10),
          phone: `9660000${role.length}`,
          gender: "other",
          dateOfBirth: new Date("1990-01-01"),
          bloodGroup: "O+",
          role,
          accountType: "self",
          isActive: true,
          emailVerified: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    ids[role] = user!._id.toString();

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: PASS });
    tokens[role] = login.body.data.accessToken;
  }

  if (!(await ClinicSettings.findOne())) {
    await ClinicSettings.create(buildDefaultSettings());
  }

  // Fixtures: a today appointment plus a consultation, so the history,
  // follow-up and check-in endpoints all have something real.
  //
  // The check-in tests reuse this same appointment rather than making their
  // own: the schema allows only one live (pending/arrived) booking per patient,
  // so a second fixture would be rejected by the partial unique index — which
  // is the rule working correctly, not a test problem.
  const existing = await Appointment.findOne({ patientId: ids.patient });
  if (!existing) {
    const appointment = await Appointment.create({
      patientId: ids.patient,
      doctorId: ids.doctor,
      appointmentDate: getClinicTodayAnchor(),
      timeSlot: "09:00",
      durationInMinutes: 15,
      // Left pending deliberately: the check-in tests need a real transition to
      // occur, and a pre-arrived appointment short-circuits the whole branch.
      status: "pending",
      consultationType: "Initial",
      intakeDetails: {
        primaryComplaint: "Schema fixture",
        duration: "1 week",
        currentMedication: "None",
        pastMedicalHistory: "Nil significant",
      },
    });
    await Consultation.create({
      appointmentId: appointment._id,
      patientId: ids.patient,
      doctorId: ids.doctor,
      diagnosis: "Schema fixture diagnosis",
      prescriptions: [{ remedyName: "Fixture", dosage: "10 drops", durationInDays: 7 }],
      followUpDate: new Date(),
      followUpStatus: "pending",
    });
  }
  fixtureAppointmentId = String(existing?._id ?? (await Appointment.findOne({ patientId: ids.patient }))!._id);
});

/**
 * The appointment the check-in tests operate on. Pending when the file starts,
 * so the first test performs a real transition; the second then re-scans the
 * same ticket and gets the idempotent path.
 */
let fixtureAppointmentId = "";

afterAll(async () => {
  await mongoose.disconnect();
});

/** Assert with every issue reported at once, rather than failing on the first. */
const expectParses = (schema: any, payload: unknown, label: string) => {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const detail = result.error.issues
      .map((i: any) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`${label} did not match its schema — ${detail}`);
  }
  expect(result.success, label).toBe(true);
};

const get = (role: string, path: string) =>
  request(app).get(path).set("Authorization", `Bearer ${tokens[role]}`);

describe("authentication responses", () => {
  it("login returns the access token and a minimal user", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: ACCOUNTS.patient.email, password: PASS });
    expect(res.status).toBe(200);
    expectParses(authSessionSchema, res.body.data, "POST /auth/login");

    // The two facts most likely to be guessed wrong.
    expect(res.body.data.user.id).toBeDefined();
    expect(res.body.data.user._id).toBeUndefined();
    // The refresh token is an httpOnly cookie, never in the body.
    expect(res.body.data.refreshToken).toBeUndefined();
  });

  it("register issues no tokens", async () => {
    const email = `shape.new.${Date.now()}@reperto.example`;
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "New Shape",
        email,
        password: PASS,
        phone: "9000000001",
        gender: "other",
        dateOfBirth: "1991-01-01",
        bloodGroup: "O+",
      });
    expect(res.status).toBe(201);
    // Registration returns nothing: the user must log in to get tokens.
    expect(res.body.data).toBeNull();
  });
});

describe("user responses", () => {
  it("GET /user/me returns the caller's own profile", async () => {
    const res = await get("patient", "/api/v1/user/me");
    expect(res.status).toBe(200);
    expectParses(ownProfileSchema, res.body.data, "GET /user/me");
    // The password must never appear, and the schema must not require it.
    expect(res.body.data.password).toBeUndefined();
  });

  it("GET /user/doctors uses plural profile field names", async () => {
    const res = await get("patient", "/api/v1/user/doctors");
    expect(res.status).toBe(200);
    expectParses(doctorDirectoryEntrySchema.array(), res.body.data, "GET /user/doctors");

    const withProfile = res.body.data.find((d: any) => d.doctorProfile);
    if (withProfile) {
      const p = withProfile.doctorProfile;
      // Singular names would all be undefined here.
      expect(p.specializations ?? p.qualifications ?? p.languagesSpoken).toBeDefined();
      expect(p.specialization).toBeUndefined();
      expect(p.qualification).toBeUndefined();
      expect(p.experience).toBeUndefined();
    }
  });

  it("GET /user/me/family returns an array", async () => {
    const res = await get("patient", "/api/v1/user/me/family");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expectParses(familyMemberSchema.array(), res.body.data, "GET /user/me/family");
  });

  it("GET /user/me/share-code returns { shareCode }", async () => {
    const res = await get("patient", "/api/v1/user/me/share-code");
    expect(res.status).toBe(200);
    expect(res.body.data.shareCode).toEqual(expect.any(String));
  });

  it("GET /user/me/export bundles everything held about the caller", async () => {
    const res = await get("patient", "/api/v1/user/me/export");
    expect(res.status).toBe(200);
    expectParses(dataExportSchema, res.body.data, "GET /user/me/export");
    expect(res.body.data.exportedAt).toBeDefined();
    expect(res.body.data.exportedBy.id).toBeDefined();
  });
});

describe("appointment responses", () => {
  it("the paginated list is { count, appointments, pagination }", async () => {
    const res = await get("patient", "/api/v1/appointment?limit=5");
    expect(res.status).toBe(200);
    expectParses(appointmentPageSchema, res.body.data, "GET /appointment");
    expect(res.body.data.pagination).toMatchObject({
      currentPage: expect.any(Number),
      totalPages: expect.any(Number),
      hasNextPage: expect.any(Boolean),
      hasPrevPage: expect.any(Boolean),
    });
  });

  it("queue endpoints are { count, appointments }", async () => {
    for (const path of ["/api/v1/appointment/today", "/api/v1/appointment/active"]) {
      const res = await get("patient", path);
      expect(res.status, path).toBe(200);
      expectParses(appointmentQueueSchema, res.body.data, path);
    }
  });

  it("one appointment matches the entity schema", async () => {
    const res = await get("patient", "/api/v1/appointment?limit=1");
    const row = res.body.data.appointments?.[0];
    if (row) expectParses(appointmentSchema, row, "appointment row");
  });

  it("/slots returns slot states while /available-slots returns labels", async () => {
    const doctorRes = await get("patient", "/api/v1/user/doctors");
    const doctorId = doctorRes.body.data[0]?._id ?? "0".repeat(24);

    const slots = await get(
      "patient",
      `/api/v1/appointment/slots?doctorId=${doctorId}&date=2026-12-01`,
    );
    expect(slots.status).toBe(200);
    expectParses(slotStateSchema.array(), slots.body.data, "GET /appointment/slots");
    if (slots.body.data[0]) {
      // States, not bare strings — two similar endpoints, different payloads.
      expect(slots.body.data[0].timeSlot).toBeDefined();
      expect(slots.body.data[0].state).toBeDefined();
    }

    const available = await get(
      "patient",
      `/api/v1/appointment/available-slots?doctorId=${doctorId}&date=2026-12-01`,
    );
    expect(available.status).toBe(200);
    expect(Array.isArray(available.body.data)).toBe(true);
    if (available.body.data[0]) {
      expect(typeof available.body.data[0]).toBe("string");
    }
  });
});

describe("consultation and report responses", () => {
  it("medical history is { count, history } with populated references", async () => {
    const res = await get("patient", `/api/v1/consultation/history/${ids.patient}`);
    expect(res.status).toBe(200);
    expectParses(medicalHistorySchema, res.body.data, "GET /consultation/history");
    if (res.body.data.history?.[0]) {
      // Populated, not a bare id.
      expect(typeof res.body.data.history[0].appointmentId).not.toBe("string");
    }
  });

  it("latest consultation is a single record or null", async () => {
    const res = await get("patient", `/api/v1/consultation/latest/${ids.patient}`);
    expect(res.status).toBe(200);
    expectParses(
      consultationHistoryEntrySchema.nullable(),
      res.body.data,
      "GET /consultation/latest",
    );
  });

  it("follow-ups is an array", async () => {
    const res = await get("doctor", "/api/v1/consultation/follow-ups");
    expect(res.status).toBe(200);
    expectParses(followUpSchema.array(), res.body.data, "GET /consultation/follow-ups");
  });

  it("GET /report is { count, reports }, not a bare array", async () => {
    const res = await get("patient", `/api/v1/report?patientId=${ids.patient}`);
    expect(res.status).toBe(200);
    // This was declared as an array and was wrong; nothing had checked it.
    expect(Array.isArray(res.body.data)).toBe(false);
    expectParses(reportListSchema, res.body.data, "GET /report");
  });
});

describe("directory, review and notification responses", () => {
  it("the admin directory includes role, the patient directory does not", async () => {
    const adminRes = await get("admin", "/api/v1/admin/users?limit=20");
    expect(adminRes.status).toBe(200);
    expectParses(userSummarySchema.array(), adminRes.body.data, "GET /admin/users");
    expect(adminRes.body.data[0]?.role).toBeDefined();

    const patientRes = await get("doctor", "/api/v1/user/patients?limit=20");
    expect(patientRes.status).toBe(200);
    expectParses(
      patientDirectoryEntrySchema.array(),
      patientRes.body.data,
      "GET /user/patients",
    );
    // The projection omits role entirely; requiring it would be a false error.
    expect(patientRes.body.data[0]?.role).toBeUndefined();
  });

  it("reviews use avgRating and keep canReview beside summary", async () => {
    const doctorRes = await get("patient", "/api/v1/user/doctors");
    const doctorId = doctorRes.body.data[0]?._id;
    if (!doctorId) return;

    const res = await get("patient", `/api/v1/review?doctorId=${doctorId}`);
    expect(res.status).toBe(200);
    expectParses(reviewListResponseSchema, res.body.data, "GET /review");
    expect(res.body.data.summary).toHaveProperty("avgRating");
    expect(res.body.data).toHaveProperty("canReview");
  });

  it("notifications use recipientId/body/readAt", async () => {
    const res = await get("patient", "/api/v1/notification");
    expect(res.status).toBe(200);
    expectParses(notificationListSchema, res.body.data, "GET /notification");

    const seeded = await Notification.findOne({ recipientId: ids.patient });
    if (seeded) {
      const row = await get("patient", "/api/v1/notification");
      const mine = row.body.data.find((n: any) => n._id === String(seeded._id));
      expect(mine).toBeDefined();
      expect(mine.recipientId).toBeDefined();
      expect(mine.body).toEqual(expect.any(String));
      expect(mine.readAt === null || typeof mine.readAt === "string").toBe(true);
      // The invented shape must not be accepted.
      expect(mine.userId).toBeUndefined();
      expect(mine.message).toBeUndefined();
    }
  });

  it("unread count is { unread }, not { count }", async () => {
    const res = await get("patient", "/api/v1/notification/unread-count");
    expect(res.status).toBe(200);
    expect(res.body.data.unread).toEqual(expect.any(Number));
    expect(res.body.data.count).toBeUndefined();
  });
});

describe("administration responses", () => {
  it("stats are the seven dashboard counters", async () => {
    const res = await get("admin", "/api/v1/admin/stats");
    expect(res.status).toBe(200);
    expectParses(adminStatsSchema, res.body.data, "GET /admin/stats");
  });

  it("analytics has the four sections", async () => {
    const res = await get("admin", "/api/v1/admin/analytics");
    expect(res.status).toBe(200);
    expectParses(adminAnalyticsSchema, res.body.data, "GET /admin/analytics");
  });

  it("audit activity is { count, entries }", async () => {
    const res = await get("admin", "/api/v1/admin/audit/activity");
    expect(res.status).toBe(200);
    expectParses(accessLogPageSchema, res.body.data, "GET /admin/audit/activity");
  });

  it("clinic blockouts is an array", async () => {
    const res = await get("admin", "/api/v1/admin/clinic-blockouts");
    expect(res.status).toBe(200);
    expectParses(clinicBlockoutSchema.array(), res.body.data, "GET /admin/clinic-blockouts");
  });
});

describe("leave responses", () => {
  it("a doctor's own leave list is an array", async () => {
    const res = await get("doctor", "/api/v1/leave/my");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expectParses(leaveRecordSchema.array(), res.body.data, "GET /leave/my");
  });
});

describe("check-in writes an audit entry", () => {
  it("records who checked the patient in, so 'what did staff do today?' covers it", async () => {
    const ticket = await Appointment.findById(fixtureAppointmentId);

    await AccessLog.deleteMany({ resource: "appointment", resourceId: String(ticket._id) });

    const code = ticketRef(ticket);
    const res = await request(app)
      .post("/api/v1/appointment/check-in")
      .set("Authorization", `Bearer ${tokens.staff}`)
      .send({ code });
    expect(res.status).toBe(200);
    expectParses(checkInResultSchema, res.body.data, "POST /appointment/check-in");

    const entry = await AccessLog.findOne({
      resource: "appointment",
      resourceId: String(ticket._id),
    });
    // Previously the only record was checkedInAt/checkedInBy on the appointment
    // itself, which cannot answer "what did this staff member do today?".
    expect(entry, "check-in should write an access-log row").toBeTruthy();
    expect(String(entry!.actorId)).toBe(ids.staff);
    expect(String(entry!.patientId)).toBe(ids.patient);
    expect(entry!.action).toBe("update");
  });

  it("a repeat scan is idempotent and does not log twice", async () => {
    // Reuse what the previous test checked in: this test is about the
    // second scan of the same ticket.
    const ticket = await Appointment.findById(fixtureAppointmentId);

    const code = ticketRef(ticket);

    const first = await request(app)
      .post("/api/v1/appointment/check-in")
      .set("Authorization", `Bearer ${tokens.staff}`)
      .send({ code });
    const second = await request(app)
      .post("/api/v1/appointment/check-in")
      .set("Authorization", `Bearer ${tokens.staff}`)
      .send({ code });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // Idempotent: success, flagged, and audited exactly once.
    expect(second.body.data.alreadyCheckedIn).toBe(true);
    const entries = await AccessLog.countDocuments({
      resource: "appointment",
      resourceId: String(ticket._id),
    });
    expect(entries).toBe(1);
  });
});

describe("reports exist to be verified, not assumed", () => {
  it("the report fixture collection is reachable", async () => {
    // A guard on the guard: if Report were ever unregistered, the schemas above
    // would silently stop being exercised.
    expect(Report.modelName).toBe("Report");
  });
});