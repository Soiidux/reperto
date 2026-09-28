# Reperto

Doctor's clinic management system: booking (direct + movie-style holds), e-ticket QR check-in, per-day front-desk queues, appointment status control with an audit trail, and in-app notifications. Split into `frontend/` (React + Vite) and `backend/` (Express + MongoDB).

## Front-desk check-in (QR e-tickets)

- The reception queue lives in `frontend/src/components/TodayQueue.tsx`, shared by the **staff** dashboard and the admin dashboard's "Reception queue" section.
- **Scanning** is the primary path (`TicketScanner`, jsQR + getUserMedia over HTTPS). **Manual entry** (typed ticket code / USB barcode scanner) is the fallback and auto-submits on Enter.
- Ticket format is unchanged: `REPERTO_TICKET:<appointmentId>:<date>:<timeSlot>`.
- `POST /api/appointment/check-in` runs against **today's** appointments only. Rescanning an already-arrived ticket is idempotent → "already checked in". A ticket that went stale after a reschedule still checks in, showing the current slot/date.
- Checking in via scan or the "Mark Arrived" control stamps the audit fields `checkedInAt` / `checkedInBy` on the appointment, and the Waiting Room row shows an audit line: *Checked in \<time\> by \<name\>*.
- Camera scanning requires HTTPS (or localhost); plain HTTP is not supported by the browser API.

## Appointment status control & rules

`PATCH /api/appointment/:id/status` — the front desk owns the queue:

| Role | Allowed |
| --- | --- |
| staff / admin | Move a booking to **any** status (`pending`, `arrived`, `completed`, `cancelled`, `no-show`), including reopening terminal ones |
| doctor | Blocked (403) — doctors cannot change appointment status |
| patient | Cancel their own booking only (403 otherwise), respecting the clinic's cancellation window |

- Cancelling via the status control opens the existing reason dialog; reopening to `pending` clears `cancellationReason` and the check-in stamp.
- Reopening a `cancelled` booking re-adds the live-booking unique indexes; if the slot or patient was rebooked meanwhile, the API returns a friendly 409 instead of a 500.

## Verification scripts

Live smoke tests against a running backend (self-seeding, use the dev database):

- `backend/scripts/e2e-status.ts` — front-desk status flow: staff/admin any→any, doctor/patient 403s, audit stamp + reopen clearing. **Time-independent — runs any time of day.**
- `backend/scripts/e2e-checkin.ts` — QR check-in via the API-booking path. Only works during clinic hours (it books a real slot for the current day).
- Automated API tests: `backend/tests/api/status.test.ts`, `backend/tests/api/checkin.test.ts` (vitest).

Run tests from `backend/` with `npm test`, or the smoke scripts with `npx tsx scripts/<name>.ts`.