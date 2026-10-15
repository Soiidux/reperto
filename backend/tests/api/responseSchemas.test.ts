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
import {
  notificationListSchema,
  patientDirectoryEntrySchema,
  publicClinicSettingsSchema,
  reviewListResponseSchema,
  reviewSchema,
  userSummarySchema,
} from "../../src/openapi/responseSchemas";

/**
 * Response schemas are only worth anything if they match what the server
 * actually sends.
 *
 * That is not a hypothetical concern: the first draft of responseSchemas.ts
 * described notifications with `userId`, `message`, `read` and a nine-value
 * type enum. The real model has always used `recipientId`, `body`, `readAt` and
 * four types. It looked completely plausible, typechecked cleanly, and would
 * have rejected every genuine notification at runtime.
 *
 * These tests hit the real endpoints and parse the real responses, so that class
 * of confident invention fails here instead of in a client.
 */

const PATIENT = { email: "resp.patient@reperto.example", password: "Test@12345" };
const DOCTOR = { email: "resp.doctor@reperto.example", password: "Test@12345" };

let patientToken = "";
let doctorToken = "";
let patientId = "";
let doctorId = "";

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  const hashed = await bcrypt.hash(PATIENT.password, 10);
  const patient = await User.findOneAndUpdate(
    { email: PATIENT.email },
    {
      $setOnInsert: {
        name: "Resp Patient",
        email: PATIENT.email,
        password: hashed,
        phone: "9880001111",
        gender: "other",
        dateOfBirth: new Date("1991-02-03"),
        bloodGroup: "B+",
        role: "patient",
        accountType: "self",
        isActive: true,
        emailVerified: true,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  patientId = patient!._id.toString();

  const doctor = await User.findOneAndUpdate(
    { email: DOCTOR.email },
    {
      $setOnInsert: {
        name: "Resp Doctor",
        email: DOCTOR.email,
        password: await bcrypt.hash(DOCTOR.password, 10),
        phone: "9880002222",
        gender: "other",
        dateOfBirth: new Date("1985-05-06"),
        bloodGroup: "O+",
        role: "doctor",
        accountType: "self",
        isActive: true,
        emailVerified: true,
      },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );
  doctorId = doctor!._id.toString();

  if (!(await ClinicSettings.findOne())) {
    await ClinicSettings.create(buildDefaultSettings());
  }

  const patientLogin = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: PATIENT.email, password: PATIENT.password });
  patientToken = patientLogin.body.data.accessToken;

  const doctorLogin = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: DOCTOR.email, password: DOCTOR.password });
  doctorToken = doctorLogin.body.data.accessToken;
});

afterAll(async () => {
  await mongoose.disconnect();
});

/** Report every problem at once, rather than failing on the first. */
const expectParses = (schema: any, payload: unknown, label: string) => {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const detail = result.error.issues
      .map((i: any) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new Error(`${label} did not match its response schema — ${detail}`);
  }
};

describe("notification response matches its schema", () => {
  it("parses a real notifications response", async () => {
    const res = await request(app)
      .get("/api/v1/notification")
      .set("Authorization", `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    expectParses(notificationListSchema, res.body.data, "GET /notification");
  });

  it("parses the unread count", async () => {
    const res = await request(app)
      .get("/api/v1/notification/unread-count")
      .set("Authorization", `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    // The field is `unread`, not `count`. A generated name would have been
    // `count` and would have read a number off `undefined`.
    expect(res.body.data).toHaveProperty("unread");
    expect(typeof res.body.data.unread).toBe("number");
    expect(res.body.data).not.toHaveProperty("count");
  });

  it("rejects the invented shape this file once described", async () => {
    // Guards the specific regression: `userId`/`message`/`read` and a
    // nine-value type enum looked reasonable and were entirely wrong.
    const wrong = {
      _id: "0".repeat(24),
      userId: "0".repeat(24),
      type: "appointment_reminder",
      title: "t",
      message: "m",
      read: false,
      createdAt: new Date().toISOString(),
    };
    const result = notificationListSchema.safeParse([wrong]);
    expect(result.success).toBe(false);
  });
});

describe("review response matches its schema", () => {
  it("parses a real reviews response", async () => {
    const res = await request(app)
      .get(`/api/v1/review?doctorId=${doctorId}`)
      .set("Authorization", `Bearer ${patientToken}`);
    expect(res.status).toBe(200);
    expectParses(reviewListResponseSchema, res.body.data, "GET /review");
  });

  it("uses avgRating and distribution, not the obvious names", async () => {
    const res = await request(app)
      .get(`/api/v1/review?doctorId=${doctorId}`)
      .set("Authorization", `Bearer ${patientToken}`);
    const summary = res.body.data.summary;
    expect(summary).toHaveProperty("avgRating");
    expect(summary).toHaveProperty("distribution");
    expect(summary).toHaveProperty("totalReviews");
    // canReview and myReview are siblings of summary, not fields inside it —
    // nesting them under summary is the natural mistake when reading this code.
    expect(res.body.data).toHaveProperty("canReview");
  });

  it("reports canReview and myReview to a patient", async () => {
    const res = await request(app)
      .get(`/api/v1/review?doctorId=${doctorId}`)
      .set("Authorization", `Bearer ${patientToken}`);
    expect(typeof res.body.data.canReview).toBe("boolean");
    // myReview is null for a patient who has not reviewed yet, not absent.
    expect(res.body.data).toHaveProperty("myReview");
  });
});

describe("directory response matches its schema", () => {
  it("parses the admin user directory", async () => {
    const admin = await User.findOneAndUpdate(
      { email: "resp.admin@reperto.example" },
      {
        $setOnInsert: {
          name: "Resp Admin",
          email: "resp.admin@reperto.example",
          password: await bcrypt.hash("Test@12345", 10),
          phone: "9880003333",
          gender: "other",
          dateOfBirth: new Date("1990-01-01"),
          bloodGroup: "O+",
          role: "admin",
          accountType: "self",
          isActive: true,
          emailVerified: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "resp.admin@reperto.example", password: "Test@12345" });
    expect(login.status).toBe(200);

    const res = await request(app)
      .get("/api/v1/admin/users?limit=100")
      .set("Authorization", `Bearer ${login.body.data.accessToken}`);
    expect(res.status).toBe(200);
    expect(admin).toBeTruthy();
    expectParses(
      userSummarySchema.array(),
      res.body.data,
      "GET /admin/users",
    );
  });

  it("parses the patient directory", async () => {
    const res = await request(app)
      .get("/api/v1/user/patients?limit=100")
      .set("Authorization", `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
    // Surface what actually came back: the first run of this test failed on
    // `role`, and the schema alone could not say which value arrived.
    const roles = [...new Set((res.body.data as { role: unknown }[]).map((r) => String(r.role)))];
    expect(roles, "patient directory rows must not leak a role").toEqual(["undefined"]);
    expectParses(
      patientDirectoryEntrySchema.array(),
      res.body.data,
      "GET /user/patients",
    );
  });
});

describe("clinic settings response matches its schema", () => {
  it("parses the public settings endpoint", async () => {
    const res = await request(app).get("/api/v1/clinic/settings");
    expect(res.status).toBe(200);
    expectParses(publicClinicSettingsSchema, res.body.data, "GET /clinic/settings");
  });
});

describe("review schema describes a populated patientId", () => {
  it("expects an embedded user, not a bare id", () => {
    // The list endpoint populates patientId and leaves doctorId alone. Typing
    // both as ids would compile and then break on the populated object.
    const bare = {
      _id: "0".repeat(24),
      patientId: "0".repeat(24),
      doctorId: "0".repeat(24),
      rating: 5,
      comment: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(reviewSchema.safeParse(bare).success).toBe(false);

    const populated = {
      ...bare,
      patientId: { _id: "0".repeat(24), name: "Someone" },
    };
    expect(reviewSchema.safeParse(populated).success).toBe(true);
  });
});