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
import { PERMISSIONS, type Role } from "../../src/utils/permissions";
import { discoverRoutes } from "../../src/openapi/generate";
import { API_ROUTES } from "../../src/routes";

/**
 * Authorization tests for the routes that gained a capability guard.
 *
 * Most of the suite is behaviour-preservation: these endpoints already had
 * inline role logic, so the guard is expected to allow exactly who it allowed
 * before. That is the property worth proving — a capability guard that quietly
 * widened access would be worse than the inline check it replaced.
 *
 * The two cases that are genuinely new:
 *   - PATCH /appointment/:id/status previously had NO route guard at all; the
 *     doctor exclusion lived in the controller and is now declarative.
 *   - The audit endpoints now declare `audit:read` rather than inheriting the
 *     router's broader `admin:manage`, so the spec advertises why they exist.
 */

const USERS: Record<Role, { email: string; password: string }> = {
  patient: { email: "rbac.patient@reperto.example", password: "Test@12345" },
  doctor: { email: "rbac.doctor@reperto.example", password: "Test@12345" },
  staff: { email: "rbac.staff@reperto.example", password: "Test@12345" },
  admin: { email: "rbac.admin@reperto.example", password: "Test@12345" },
};

const tokens: Partial<Record<Role, string>> = {};
const userIds: Partial<Record<Role, string>> = {};

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  await mongoose.connect(uri);

  for (const [role, { email, password }] of Object.entries(USERS) as [
    Role,
    { email: string; password: string },
  ][]) {
    const user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          name: `RBAC ${role}`,
          email,
          password: await bcrypt.hash(password, 10),
          phone: `9876543${role.length}`,
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
    userIds[role] = user!._id.toString();

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    tokens[role] = login.body.data.accessToken;
  }

  if (!(await ClinicSettings.findOne())) {
    await ClinicSettings.create(buildDefaultSettings());
  }
});

beforeEach(async () => {
  await Appointment.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

/**
 * A pending appointment belonging to the patient user.
 *
 * `daysAhead` exists because patient cancellation is blocked inside the clinic's
 * configured cancellation window, so a same-day slot cannot exercise it.
 */
const makeAppointment = async (daysAhead = 0) => {
  const { getClinicTodayAnchor } = await import("../../src/utils/clinicDate");
  const DAY_MS = 24 * 60 * 60 * 1000;
  const appointment = await Appointment.create({
    patientId: userIds.patient,
    doctorId: userIds.doctor,
    appointmentDate: new Date(getClinicTodayAnchor().getTime() + daysAhead * DAY_MS),
    timeSlot: "09:00",
    durationInMinutes: 15,
    status: "pending",
    consultationType: "Initial",
    // Required by the model. These tests are about authorization, so the
    // simplest valid shape is enough.
    intakeDetails: {
      primaryComplaint: "Authorization fixture",
      duration: "1 week",
      currentMedication: "None",
      pastMedicalHistory: "Nil significant",
    },
  });
  return appointment;
};

const asRole = (role: Role) => ({
  get: (path: string) =>
    request(app).get(path).set("Authorization", `Bearer ${tokens[role]}`),
  patch: (path: string, body: unknown) =>
    request(app)
      .patch(path)
      .set("Authorization", `Bearer ${tokens[role]}`)
      .send(body),
});

describe("PATCH /appointment/:id/status — appointments:edit-status", () => {
  const allowed = PERMISSIONS["appointments:edit-status"];

  it("states in the matrix exactly which roles the route admits", () => {
    expect(allowed).toEqual(["patient", "staff", "admin"]);
    // Doctors are excluded: the consultation is closed from the consultation
    // record, not by moving the appointment.
    expect(allowed).not.toContain("doctor");
  });

  it("lets the front desk move a booking to any status", async () => {
    const appointment = await makeAppointment();
    for (const role of ["staff", "admin"] as const) {
      const res = await asRole(role).patch(`/api/v1/appointment/${appointment._id}/status`, {
        status: "arrived",
      });
      expect(res.status, `${role} should be allowed`).toBe(200);
      expect(res.body.data.status ?? res.body.appointment?.status).toBeDefined();
    }
  });

  it("refuses a doctor, who holds no status-editing capability", async () => {
    const appointment = await makeAppointment();
    const res = await asRole("doctor").patch(
      `/api/v1/appointment/${appointment._id}/status`,
      { status: "arrived" },
    );
    expect(res.status).toBe(403);
    // The guard, not the controller, is what stopped it.
    expect(res.body.message).toBe("Forbidden");
  });

  it("lets a patient cancel their own booking", async () => {
    // A week out, so the clinic's cancellation window does not apply. That is
    // a separate constraint with its own test, not part of who may cancel.
    const appointment = await makeAppointment(7);
    const res = await asRole("patient").patch(
      `/api/v1/appointment/${appointment._id}/status`,
      { status: "cancelled" },
    );
    expect(res.status).toBe(200);
  });

  it("refuses a patient any status other than cancel", async () => {
    // The capability admits patients; this restriction is ownership- and
    // value-scoped, so it stays in the controller by design.
    const appointment = await makeAppointment();
    for (const status of ["arrived", "completed", "no-show"]) {
      const res = await asRole("patient").patch(
        `/api/v1/appointment/${appointment._id}/status`,
        { status },
      );
      expect(res.status, `patient should not set ${status}`).toBe(403);
    }
  });

  it("stamps who checked the patient in", async () => {
    const appointment = await makeAppointment();
    await asRole("staff").patch(`/api/v1/appointment/${appointment._id}/status`, {
      status: "arrived",
    });
    const reloaded = await Appointment.findById(appointment._id).lean();
    expect(reloaded?.checkedInAt).toBeTruthy();
    expect(String(reloaded?.checkedInBy)).toBe(userIds.staff);
  });
});

describe("GET /appointment/* — appointments:read", () => {
  it("admits every role, because every role has appointments to see", () => {
    expect(PERMISSIONS["appointments:read"]).toEqual([
      "patient",
      "doctor",
      "staff",
      "admin",
    ]);
  });

  it("scopes a patient to their own appointments", async () => {
    await makeAppointment();
    const res = await asRole("patient").get("/api/v1/appointment/today");
    expect(res.status).toBe(200);
    const ids = (res.body.data.appointments ?? []).map(
      (a: { patientId: { _id: string } | string }) =>
        typeof a.patientId === "string" ? a.patientId : a.patientId?._id,
    );
    // Every row belongs to this patient or a dependent they act for.
    expect(ids.every((id: string) => id === userIds.patient)).toBe(true);
  });

  it("scopes a doctor to their own queue", async () => {
    await makeAppointment();
    const res = await asRole("doctor").get("/api/v1/appointment/today");
    expect(res.status).toBe(200);
    const doctorIds = (res.body.data.appointments ?? []).map(
      (a: { doctorId: { _id: string } | string }) =>
        typeof a.doctorId === "string" ? a.doctorId : a.doctorId?._id,
    );
    expect(doctorIds.every((id: string) => id === userIds.doctor)).toBe(true);
  });

  it("requires a session", async () => {
    const res = await request(app).get("/api/v1/appointment/today");
    expect(res.status).toBe(401);
  });
});

describe("audit endpoints — audit:read", () => {
  // Built lazily: a describe body runs before beforeAll, so userIds is still
  // empty here and a top-level const would bake "undefined" into every path.
  const auditPaths = () => [
    "/api/v1/admin/audit/activity",
    `/api/v1/admin/audit/patient/${userIds.patient}`,
    `/api/v1/admin/audit/patient/${userIds.patient}/by-staff`,
  ];

  it("is admin-only, matching the matrix", () => {
    expect(PERMISSIONS["audit:read"]).toEqual(["admin"]);
  });

  it("declares audit:read rather than inheriting the router's admin:manage", () => {
    const routes = discoverRoutes(API_ROUTES);
    for (const path of [
      "/api/v1/admin/audit/activity",
      "/api/v1/admin/audit/patient/{patientId}",
      "/api/v1/admin/audit/patient/{patientId}/by-staff",
    ]) {
      expect(
        routes.find((r) => r.openApiPath === path)?.permission,
        path,
      ).toBe("audit:read");
    }
  });

  it("admits an admin", async () => {
    for (const path of auditPaths()) {
      const res = await asRole("admin").get(path);
      expect(res.status, path).toBe(200);
    }
  });

  it("refuses every other role — the audit log is itself sensitive", async () => {
    for (const role of ["patient", "doctor", "staff"] as const) {
      for (const path of auditPaths()) {
        const res = await asRole(role).get(path);
        expect(res.status, `${role} on ${path}`).toBe(403);
      }
    }
  });

  it("refuses an anonymous caller", async () => {
    const res = await request(app).get("/api/v1/admin/audit/activity");
    expect(res.status).toBe(401);
  });
});

describe("read endpoints declare their capability", () => {
  const expectations: [string, string][] = [
    ["GET", "/api/v1/consultation/history/{patientId}"],
    ["GET", "/api/v1/report"],
    ["GET", "/api/v1/review"],
    ["PATCH", "/api/v1/appointment/{id}/reschedule"],
  ];

  it("each names the capability its route enforces", () => {
    const routes = discoverRoutes(API_ROUTES);
    for (const [method, path] of expectations) {
      const route = routes.find((r) => r.method === method && r.openApiPath === path);
      expect(route, `${method} ${path} should exist`).toBeTruthy();
      expect(route!.permission, `${method} ${path}`).toBeTruthy();
      expect(route!.requiresAuth, `${method} ${path}`).toBe(true);
    }
  });
});