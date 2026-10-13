# Authorization

Access control is defined in **one place**: `backend/src/utils/permissions.ts`.
Routes declare a *capability* and the matrix decides which roles hold it, so
"what can a staff member do?" is answered by reading one file rather than
grepping every controller.

## Using it

```ts
// Route: state what the endpoint does
router.post("/check-in", checkInLimiter, protect,
  requirePermission("appointments:check-in"), checkInByTicket);

// Anywhere in code:
if (can(user.role, "reports:upload")) { ... }
```

Prefer `requirePermission(...)` over a raw role list. The old
`authorize("patient", "staff", "admin")` still exists but is deprecated — it
scatters role knowledge back across the route table.

## The matrix

| Capability | Roles |
|---|---|
| `appointments:book` | patient, staff, admin |
| `appointments:hold` | patient |
| `appointments:check-in` | staff, admin |
| `appointments:edit-status` | patient, staff, admin |
| `appointments:reschedule` | patient, doctor, staff, admin |
| `appointments:read` | patient, doctor, staff, admin |
| `consultations:create` | doctor |
| `consultations:read` | patient, doctor, staff, admin |
| `consultations:manage-follow-up` | doctor, staff, admin |
| `reports:upload` | patient, staff, admin |
| `reports:delete` | patient, staff, admin |
| `reports:read` | patient, doctor, staff, admin |
| `reviews:write` | patient |
| `reviews:delete` | patient |
| `reviews:read` | patient, doctor, staff, admin |
| `patients:list` | doctor, staff, admin |
| `leave:manage` | doctor |
| `admin:manage` | admin |
| `audit:read` | admin |

Regenerate this table from `PERMISSION_MATRIX` rather than editing by hand —
`tests/unit/permissions.test.ts` asserts it, so the table cannot drift from the
code without failing the suite.

## Rules that look surprising, and are deliberate

- **Admin is *not* omnipotent.** It holds every operational capability but
  **not** `consultations:create`, `leave:manage`, `reviews:write` or
  `appointments:hold`. Those are clinical or identity-bound: an admin writing a
  consultation, filing a doctor's leave, or rating a doctor would be
  impersonation rather than administration. This is separation of duties.
- **Doctors cannot check in patients or upload reports.** Reception is
  `staff`/`admin`; `appointments:check-in` and `reports:upload` exclude them.
- **Staff cannot read the access audit.** They can read patient records, but the
  log of *who read which records* is itself sensitive — it exposes which
  clinicians are looking at which patients. Admin only.
- **Patients can cancel but not otherwise edit their own booking.** Status
  editing is allowed for `patient` because the backend restricts patients to
  `cancelled` specifically; doctors are excluded entirely.

## What the matrix deliberately cannot express

Capabilities that also depend on **ownership** stay in the controller:

- "is this *my* patient?" → `canActForPatient(userId, patientId)`
- "am I the *assigned* doctor?" → `doctorId === user.id`
- "have I *completed a visit* with this doctor?" (required to rate) → checked in
  `upsertReview`

A role matrix answers *what kind of action*; it cannot answer *whose data*.
Mixing the two tends to produce roles like `doctor_or_owner`, which is where
authorization bugs live. When a rule needs both, do the capability check and
the ownership check separately.

## Changing a permission

1. Edit `PERMISSIONS` in `backend/src/utils/permissions.ts`.
2. Update the expected list in `tests/unit/permissions.test.ts` — a new
   capability absent there fails the suite, so granting access is never a
   silent edit.
3. Update the table above.