/**
 * End-to-end check for the reception ticket check-in flow, against the
 * running dev server (http://localhost:5000). Not part of the vitest suite —
 * this is a one-shot smoke test driven manually after backend restarts.
 *
 *   npx tsx scripts/e2e-checkin.ts
 *
 * Exercises: patient books today -> staff checks in the printed ticket code
 * -> idempotent re-scan reports "already checked in".
 */
import { formatInTimeZone } from "date-fns-tz";
import { CLINIC_TIMEZONE } from "../src/constants/clinic";
import { ticketRef } from "../src/utils/ticket";

const BASE = "http://localhost:5000/api";

type AppointmentLike = { _id: string; appointmentDate: string; timeSlot: string };

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  const marker = ok ? "PASS" : "FAIL";
  if (!ok) failures += 1;
  console.log(`[${marker}] ${label}${detail === undefined ? "" : ` -> ${JSON.stringify(detail)}`}`);
};

const api = async (
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {}
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
    // non-JSON body (e.g. QR png) — fine
  }
  return { status: response.status, body: json as Record<string, any> };
};

const login = async (email: string, password: string) => {
  const res = await api("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  if (res.status !== 200) throw new Error(`login ${email} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data.accessToken as string;
};

// Clinic-today in the clinic timezone, e.g. "2026-09-21".
const clinicToday = formatInTimeZone(new Date(), CLINIC_TIMEZONE, "yyyy-MM-dd");

const patientToken = await login("patient@reperto.com", "Patient@123");
const staffToken = await login("staff@reperto.com", "Staff@123");
check("patient + staff logged in", Boolean(patientToken && staffToken));

// 1. A doctor to book with.
const doctorsRes = await api("/user/doctors");
const doctorList = doctorsRes.body?.data ?? [];
const doctor = (Array.isArray(doctorList) ? doctorList : []).find((d: any) => d?._id);
check("public doctor list resolves a doctor", Boolean(doctor?._id), doctor?.name);

// 2. A free slot today with that doctor.
const slotsRes = await api(
  `/appointment/available-slots?doctorId=${doctor._id}&date=${clinicToday}&durationInMinutes=15`,
  { token: patientToken }
);
const slotRaw = slotsRes.body?.data ?? [];
const slots: string[] = (Array.isArray(slotRaw) ? slotRaw : []).map((s: any) =>
  typeof s === "string" ? s : s?.timeSlot
);
const slot = slots[0];
check("an available slot exists for today", Boolean(slot), slot);

// 3. Book it as the patient. If they already have a live booking, reuse the
//    existing one from today so the unique indexes are respected.
const bookingRes = await api("/appointment/", {
  method: "POST",
  token: patientToken,
  body: {
    doctorId: doctor._id,
    appointmentDate: clinicToday,
    timeSlot: slot,
    durationInMinutes: 15,
    consultationType: "Initial",
    intakeDetails: {
      primaryComplaint: "E2E check-in smoke test",
      duration: "2 days",
      currentMedication: "None",
      pastMedicalHistory: "None",
    },
  },
});

let appointment: AppointmentLike;
if (bookingRes.status === 201) {
  appointment = bookingRes.body?.data;
  check("booking created (201)", Boolean(appointment?._id), slot);
} else {
  // 409 = patient already has an upcoming appointment: use that one instead.
  if (bookingRes.status !== 409) {
    check("booking created (201)", false, bookingRes);
    process.exit(failures ? 1 : 0);
  }
  const listRes = await api(
    `/appointment/?status=pending&from=${clinicToday}&to=${clinicToday}`,
    { token: patientToken }
  );
  const list = listRes.body?.data?.appointments ?? [];
  appointment = list.find((a: any) => String(a.appointmentDate).startsWith(clinicToday));
  check("reused the patient's existing today booking", Boolean(appointment?._id));
}

// 4. Staff checks in using the ticket reference.
const code = ticketRef(appointment);
console.log(`   ticket code -> ${code}`);

const first = await api("/appointment/check-in", {
  method: "POST",
  token: staffToken,
  body: { code },
});
check("first scan checks the patient in (200 + arrived)", first.status === 200, {
  alreadyCheckedIn: first.body?.data?.alreadyCheckedIn,
  status: first.body?.data?.appointment?.status,
  patient: first.body?.data?.appointment?.patient?.name,
});
check(
  "first scan reports a fresh check-in",
  first.body?.data?.alreadyCheckedIn === false && first.body?.data?.appointment?.status === "arrived",
  first.body
);

const second = await api("/appointment/check-in", {
  method: "POST",
  token: staffToken,
  body: { code },
});
check(
  "second scan is idempotent — reports already checked in",
  second.status === 200 && second.body?.data?.alreadyCheckedIn === true,
  {
    message: second.body?.message,
    alreadyCheckedIn: second.body?.data?.alreadyCheckedIn,
    status: second.body?.data?.appointment?.status,
  }
);

// 5. A garbage code is rejected cleanly.
const garbage = await api("/appointment/check-in", {
  method: "POST",
  token: staffToken,
  body: { code: "not-a-ticket" },
});
check("malformed code is rejected (400)", garbage.status === 400, garbage.body?.message);

// 6. Doctors are locked out of the front desk: no check-in, no status edits.
const doctorToken = await login("doctor@reperto.com", "Doctor@123");

const doctorScan = await api("/appointment/check-in", {
  method: "POST",
  token: doctorToken,
  body: { code },
});
check("doctor cannot check patients in (403)", doctorScan.status === 403, doctorScan.body?.message);

const doctorStatus = await api(`/appointment/${appointment._id}/status`, {
  method: "PATCH",
  token: doctorToken,
  body: { status: "completed" },
});
check("doctor cannot change status (403)", doctorStatus.status === 403, doctorStatus.body?.message);

// Patients may only cancel their own booking, nothing else.
const patientStatus = await api(`/appointment/${appointment._id}/status`, {
  method: "PATCH",
  token: patientToken,
  body: { status: "completed" },
});
check("patient cannot set a non-cancel status (403)", patientStatus.status === 403, patientStatus.body?.message);

// 7. Staff can move the booking to any status — reopen it and watch the audit clear.
const reopen = await api(`/appointment/${appointment._id}/status`, {
  method: "PATCH",
  token: staffToken,
  body: { status: "pending" },
});
check(
  "staff can reopen the booking to pending (200)",
  reopen.status === 200 && reopen.body?.data?.status === "pending",
  reopen.body?.message
);

const findRow = (body: any) =>
  (body?.data?.appointments ?? []).find((a: any) => String(a._id) === String(appointment._id));

const afterReopen = findRow((await api("/appointment/today", { token: staffToken })).body);
check(
  "reopen clears the check-in audit stamp",
  Boolean(afterReopen) && !afterReopen.checkedInAt,
  { checkedInAt: afterReopen?.checkedInAt ?? null }
);

// 8. Check in again; the queue records who did it.
const reScan = await api("/appointment/check-in", {
  method: "POST",
  token: staffToken,
  body: { code },
});
check(
  "can check in again after a reopen",
  reScan.status === 200 && reScan.body?.data?.appointment?.status === "arrived",
  reScan.body?.message
);

const afterCheckIn = findRow((await api("/appointment/today", { token: staffToken })).body);
check(
  "audit line records who checked the patient in",
  Boolean(afterCheckIn?.checkedInAt && afterCheckIn?.checkedInBy?.name),
  { checkedInAt: afterCheckIn?.checkedInAt ?? null, checkedInBy: afterCheckIn?.checkedInBy?.name ?? null }
);

console.log(failures === 0 ? "\nAll E2E check-in checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures ? 1 : 0);