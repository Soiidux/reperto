/**
 * End-to-end check for the front-desk status editor + check-in audit trail,
 * against the running dev server (http://localhost:5000).
 *
 *   npx tsx scripts/e2e-status.ts
 *
 * Unlike e2e-checkin.ts (which books through the availability API and so only
 * works during clinic hours), this seeds one appointment for today directly so
 * it can run at any time. It is repeatable: the seeded booking is removed at
 * the end.
 *
 * Exercises: staff check-in stamps the audit -> staff reopen to pending clears
 * it -> re-check-in works -> GET /appointment/today exposes doctor + auditor ->
 * doctors and patients are locked out of status edits -> staff can set any
 * status.
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import Appointment from "../src/db/models/appointment.model";
import User from "../src/db/models/user.model";
import { getClinicTodayAnchor } from "../src/utils/clinicDate";
import { ticketRef } from "../src/utils/ticket";

const BASE = "http://localhost:5000/api";
const SEED_TAG = "E2E status smoke";
const SMOKE_EMAIL = "e2e.smoke.patient@reperto.example";
const SMOKE_PASSWORD = "Test@12345";

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  const marker = ok ? "PASS" : "FAIL";
  if (!ok) failures += 1;
  console.log(`[${marker}] ${label}${detail === undefined ? "" : ` -> ${JSON.stringify(detail)}`}`);
};

const api = async (
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
) => {
  const response = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // non-JSON body — fine
  }
  return { status: response.status, body: json as Record<string, any> };
};

const login = async (email: string, password: string) => {
  const res = await api("/auth/login", { method: "POST", body: { email, password } });
  if (res.status !== 200) {
    throw new Error(`login ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken as string;
};

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");
await mongoose.connect(uri);

const doctor = await User.findOne({ role: "doctor", isActive: true });
if (!doctor) throw new Error("no active doctor found");

// A dedicated throwaway patient keeps the smoke test independent of the demo
// account's live-booking state (one live booking per patient is enforced).
const hashed = await bcrypt.hash(SMOKE_PASSWORD, 10);
const patient = await User.findOneAndUpdate(
  { email: SMOKE_EMAIL },
  {
    $setOnInsert: {
      name: "E2E Smoke Patient",
      email: SMOKE_EMAIL,
      password: hashed,
      phone: "9000000000",
      gender: "other",
      dateOfBirth: new Date("1990-01-01"),
      bloodGroup: "O+",
      role: "patient",
      accountType: "self",
      isActive: true,
      emailVerified: true,
    },
  },
  { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
);

// Remove any booking left over from an interrupted previous run.
await Appointment.deleteMany({ "intakeDetails.primaryComplaint": SEED_TAG });

const appointment = await Appointment.create({
  patientId: patient!._id,
  doctorId: doctor._id,
  appointmentDate: getClinicTodayAnchor(),
  timeSlot: "20:45",
  durationInMinutes: 15,
  status: "pending",
  consultationType: "Initial",
  intakeDetails: {
    primaryComplaint: SEED_TAG,
    duration: "1 day",
    currentMedication: "None",
    pastMedicalHistory: "None",
  },
});
console.log(`   seeded appointment ${appointment._id} (${doctor.name} @ ${appointment.timeSlot})`);

const code = ticketRef(appointment);
const staffToken = await login("staff@reperto.com", "Staff@123");
const doctorToken = await login("doctor@reperto.com", "Doctor@123");
const patientToken = await login(SMOKE_EMAIL, SMOKE_PASSWORD);
check("staff + doctor + patient logged in", Boolean(staffToken && doctorToken && patientToken));

const findRow = (body: any) =>
  (body?.data?.appointments ?? []).find((a: any) => String(a._id) === String(appointment._id));

// 1. Staff scan stamps the check-in audit.
const first = await api("/appointment/check-in", {
  method: "POST",
  token: staffToken,
  body: { code },
});
check(
  "staff check-in moves the booking to arrived",
  first.status === 200 && first.body?.data?.appointment?.status === "arrived",
  first.body?.message,
);
check("check-in response carries the audit time", Boolean(first.body?.data?.appointment?.checkedInAt));

const afterFirst = findRow((await api("/appointment/today", { token: staffToken })).body);
check(
  "today's queue shows the doctor and who checked the patient in",
  Boolean(afterFirst?.doctorId?.name && afterFirst?.checkedInBy?.name),
  { doctor: afterFirst?.doctorId?.name ?? null, checkedInBy: afterFirst?.checkedInBy?.name ?? null },
);

// 2. Reopen to pending clears the audit stamp.
const reopen = await api(`/appointment/${appointment._id}/status`, {
  method: "PATCH",
  token: staffToken,
  body: { status: "pending" },
});
check(
  "staff can reopen the booking to pending",
  reopen.status === 200 && reopen.body?.data?.status === "pending",
  reopen.body?.message,
);

const afterReopen = findRow((await api("/appointment/today", { token: staffToken })).body);
check(
  "reopen clears the audit stamp",
  Boolean(afterReopen) && !afterReopen.checkedInAt,
  { checkedInAt: afterReopen?.checkedInAt ?? null },
);

// 3. A reopened booking can be checked in again.
const reScan = await api("/appointment/check-in", {
  method: "POST",
  token: staffToken,
  body: { code },
});
check(
  "re-scan after reopen arrives the booking again",
  reScan.status === 200 && reScan.body?.data?.appointment?.status === "arrived",
  reScan.body?.message,
);

// 4. Access control: doctors and patients cannot edit status.
const doctorStatus = await api(`/appointment/${appointment._id}/status`, {
  method: "PATCH",
  token: doctorToken,
  body: { status: "completed" },
});
check("doctor cannot change status (403)", doctorStatus.status === 403, doctorStatus.body?.message);

const patientStatus = await api(`/appointment/${appointment._id}/status`, {
  method: "PATCH",
  token: patientToken,
  body: { status: "completed" },
});
check("patient cannot set a non-cancel status (403)", patientStatus.status === 403, patientStatus.body?.message);

// 5. Staff can move it anywhere — arrived -> completed.
const complete = await api(`/appointment/${appointment._id}/status`, {
  method: "PATCH",
  token: staffToken,
  body: { status: "completed" },
});
check(
  "staff can set any status (arrived -> completed)",
  complete.status === 200 && complete.body?.data?.status === "completed",
  complete.body?.message,
);

// Clean up so the dev database is left as we found it.
await Appointment.deleteOne({ _id: appointment._id });
await User.deleteOne({ _id: patient!._id });
await mongoose.disconnect();

console.log(failures === 0 ? "\nAll E2E status checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures ? 1 : 0);
