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
import AccessLog, { recordAccess } from "../../src/db/models/accessLog.model";

/**
 * The failure mode this covers produced no symptom whatsoever.
 *
 * A caller passed a *populated* document where an id was expected.
 * `String(populatedDoc)` is `"[object Object]"`; `mongoose.isValidObjectId`
 * rejected it; `recordAccess` returned early without writing — and without
 * saying anything. The access log looked complete, and the check-in audit trail
 * was empty.
 *
 * Two properties are locked here:
 *   1. a populated document now yields a usable id, so the row is written;
 *   2. when an id really is unusable, the drop is counted rather than silent —
 *      because a silently missing audit row is indistinguishable from a
 *      complete one.
 */

const PASS = "Test@12345";
const ids: Record<string, string> = {};
const tokens: Record<string, string> = {};

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  for (const role of ["patient", "staff"] as const) {
    const email = `auditdrop.${role}@reperto.example`;
    const user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          name: `Audit ${role}`,
          email,
          password: await bcrypt.hash(PASS, 10),
          phone: `9640000${role.length}`,
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
});

beforeEach(async () => {
  await AccessLog.deleteMany({});
  recordAccess.dropped = 0;
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("recordAccess tolerates a populated caller", () => {
  it("writes the row when given a populated document instead of an id", async () => {
    // Exactly the check-in situation: patientId populated to show the name.
    const populated = await User.findById(ids.patient)
      .populate("name")
      .then((u) => u!);

    await recordAccess({
      actorId: ids.staff,
      actorRole: "staff",
      patientId: populated, // not populated.patientId
      resource: "appointment",
      action: "update",
      route: "POST /api/appointment/check-in",
    });

    const rows = await AccessLog.find({});
    expect(rows).toHaveLength(1);
    expect(String(rows[0].patientId)).toBe(ids.patient);
    expect(recordAccess.dropped).toBe(0);
  });

  it("accepts a populated resourceId too", async () => {
    const populated = (await User.findById(ids.patient))!;
    await recordAccess({
      actorId: ids.staff,
      actorRole: "staff",
      patientId: ids.patient,
      resource: "appointment",
      resourceId: populated,
      action: "update",
    });
    const rows = await AccessLog.find({});
    expect(rows).toHaveLength(1);
    expect(String(rows[0].resourceId)).toBe(ids.patient);
    expect(recordAccess.dropped).toBe(0);
  });
});

describe("a dropped audit entry is never silent", () => {
  it("counts an entry it cannot write rather than discarding it quietly", async () => {
    // patientId is the stringified-object bug in its purest form.
    await recordAccess({
      actorId: ids.staff,
      actorRole: "staff",
      patientId: String({}),
      resource: "report",
      action: "read",
    });

    expect(await AccessLog.countDocuments({})).toBe(0);
    // Previously this was a bare `return` — indistinguishable from "nothing to
    // audit", which is exactly what made the original bug invisible.
    expect(recordAccess.dropped).toBe(1);
  });

  it("counts a half-formed entry rather than writing half a row", async () => {
    await recordAccess({
      actorId: ids.staff,
      actorRole: "staff",
      patientId: "",
      resource: "report",
      action: "read",
    });
    expect(await AccessLog.countDocuments({})).toBe(0);
    expect(recordAccess.dropped).toBe(1);
  });

  it("keeps the counter climbing so a systematic failure is visible", async () => {
    for (let i = 0; i < 3; i += 1) {
      await recordAccess({
        actorId: ids.staff,
        actorRole: "staff",
        patientId: "[object Object]",
        resource: "report",
        action: "read",
      });
    }
    expect(recordAccess.dropped).toBe(3);
  });
});

describe("valid entries never move the counter", () => {
  it("leaves `dropped` at zero on the happy path", async () => {
    await recordAccess({
      actorId: ids.staff,
      actorRole: "staff",
      patientId: ids.patient,
      resource: "consultation",
      action: "read",
      route: "GET /api/consultation/history/:patientId",
      ip: "127.0.0.1",
    });
    expect(recordAccess.dropped).toBe(0);
    expect(await AccessLog.countDocuments({})).toBe(1);
  });

  it("still writes when only resourceId is absent", async () => {
    await recordAccess({
      actorId: ids.staff,
      actorRole: "staff",
      patientId: ids.patient,
      resource: "report",
      action: "read",
    });
    const row = await AccessLog.findOne({});
    expect(row).toBeTruthy();
    expect(row!.resourceId).toBeUndefined();
    expect(recordAccess.dropped).toBe(0);
  });
});

describe("check-in writes an audit row through the real endpoint", () => {
  it("records the staff member, the patient and the appointment", async () => {
    // The end-to-end version of the regression: if this passes, the populated
    // patient is being read correctly at the call site too.
    const Appointment = (await import("../../src/db/models/appointment.model")).default;
    const { getClinicTodayAnchor } = await import("../../src/utils/clinicDate");
    const { ticketRef } = await import("../../src/utils/ticket");

    await Appointment.deleteMany({ patientId: ids.patient });
    const appointment = await Appointment.create({
      patientId: ids.patient,
      doctorId: ids.staff,
      appointmentDate: getClinicTodayAnchor(),
      timeSlot: "13:15",
      durationInMinutes: 15,
      status: "pending",
      consultationType: "Follow-up",
      intakeDetails: {
        primaryComplaint: "Audit endpoint fixture",
        duration: "1 week",
        currentMedication: "None",
        pastMedicalHistory: "Nil significant",
      },
    });

    const res = await request(app)
      .post("/api/v1/appointment/check-in")
      .set("Authorization", `Bearer ${tokens.staff}`)
      .send({ code: ticketRef(appointment) });

    expect(res.status).toBe(200);
    const row = await AccessLog.findOne({
      resource: "appointment",
      resourceId: String(appointment._id),
    });
    expect(row, "check-in must leave an audit row").toBeTruthy();
    expect(String(row!.actorId)).toBe(ids.staff);
    expect(String(row!.patientId)).toBe(ids.patient);
    expect(recordAccess.dropped).toBe(0);
  });
});