# ADR 0001 — Dates, times and the clinic timezone

**Status:** Accepted (current behaviour, documented)
**Date:** 2026-10-13

## Context

Reperto books appointments on a 15-minute grid, respects per-weekday opening
hours, sends reminders, and renders "open now" on the public site. All of that
depends on agreeing on what "today" and "now" mean.

## Decision

**The clinic operates in a single timezone: `Asia/Kolkata`.** It is defined once
in `backend/src/constants/clinic.ts` as `CLINIC_TIMEZONE` and every date-sensitive
path reads it from there.

Two storage conventions follow from that:

1. **Calendar dates are stored as UTC midnight.**
   `appointmentDate`, leave dates and blockout dates are the *calendar day* the
   event happens on, not an instant. Storing them at UTC midnight makes
   equality and range comparisons exact. `getClinicTodayAnchor()` produces
   today's anchor.

   Consequence: rendering such a value must pin `timeZone: "UTC"`. Reading it
   through local getters shows the **previous day** for any reader west of UTC
   (a booking on 1 Jan renders as "31 Dec" in New York). The frontend exposes
   `formatClinicDate()` / `formatClinicDateKey()` for exactly this, and
   `frontend/src/lib/dateFormat.test.ts` locks the behaviour.

2. **Instants are stored as real timestamps and rendered in local time.**
   `createdAt`, `updatedAt`, `checkedInAt` and `followUpDate` are moments in
   time, so a patient's local rendering is the correct behaviour. Do **not** pin
   UTC for these — that would show the wrong time of day.

## Which one is a value?

| Value | Kind | Render with |
|---|---|---|
| `appointmentDate` | calendar day (UTC midnight) | `formatClinicDate()` |
| leave `startingDate` / `endingDate` | calendar day | `formatClinicDate()` |
| blockout date | calendar day | `formatClinicDate()` |
| `"YYYY-MM-DD"` keys (slot grid, `dateKey`) | calendar day | `formatClinicDateKey()` |
| `createdAt` / `updatedAt` / `checkedInAt` | instant | `toLocaleDateString` |
| `followUpDate` | instant (`baseDate + N days`) | `toLocaleDateString` |

"Open right now" is the one place the two meet: `getClinicLiveStatus()` resolves
the current clinic-time against the day's slot grid on the server, so the client
never has to reason about the clinic's timezone.

## What would invalidate this

This decision breaks if the clinic ever:

- **operates at more than one physical location in different timezones** —
  "today's schedule" is per-location, and a single `CLINIC_TIMEZONE` cannot
  express it. The slot grid, "open now", reminders and the today-queue would all
  need a per-clinic timezone.
- **serves patients in other timezones** — less severe. Storage and scheduling
  stay correct; only the *rendering* of instants needs care, and the frontend
  already renders those in the reader's local time.

Migration in either case is not trivial, because calendar dates are stored
without a timezone and would need rewriting.

## Consequences

- `CLINIC_TIMEZONE` is a single constant; changing it changes the clinic.
- Every date render is either explicitly UTC (calendar days) or explicitly local
  (instants). There is no "default" case, which is deliberate: the default case
  is what produced the `getAge` off-by-one bug fixed in August 2026.