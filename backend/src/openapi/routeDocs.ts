import { z } from "zod";
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
  patientDirectoryEntrySchema,
  publicClinicSettingsSchema,
  refreshedAccessTokenSchema,
  reportListSchema,
  reportSchema,
  reviewListResponseSchema,
  reviewSchema,
  shareCodeSchema,
  slotStateSchema,
  userSummarySchema,
} from "./responseSchemas";
import {
  adminUsersQuerySchema,
  appointmentsQuerySchema,
  arrivedQuerySchema,
  auditActivityQuerySchema,
  auditPatientQuerySchema,
  clinicBlockoutsQuerySchema,
  consultationsQuerySchema,
  doctorsQuerySchema,
  exportAppointmentsQuerySchema,
  followUpsQuerySchema,
  notificationsQuerySchema,
  patientDirectoryQuerySchema,
  queueQuerySchema,
  reportsQuerySchema,
  reviewsQuerySchema,
  slotStatesQuerySchema,
} from "../zodQuerySchemas";

/**
 * Documentation the route itself cannot declare.
 *
 * Everything mechanical — path, method, authentication, required capability,
 * request body schema — is read off the live middleware stack by
 * openapi/generate.ts. What remains is the two things Express has nowhere to
 * put:
 *
 *   1. prose a human should read (summary, description, response shape), and
 *   2. query parameters, which `validate()` historically ignored.
 *
 * For query parameters the generator emits `x-query-params-documented-only`,
 * because describing a parameter the server never enforces is the easiest way
 * to publish a specification that lies. The defaults below are the ones the
 * controllers actually use, not guesses.
 *
 * Keyed by `"METHOD /api/v1/..."`. tests/unit/openapi.test.ts asserts every key
 * resolves to a real route, so a renamed route cannot leave an orphan entry
 * behind.
 */
export type RouteDoc = {
  summary: string;
  description?: string;
  /** Query string schema. Documented; enforced only if `validate` covers it. */
  query?: z.ZodTypeAny;
  /** Body schema for multipart endpoints (report uploads). */
  multipart?: z.ZodTypeAny;
  /** Per-method response descriptions, e.g. { POST: "201 + tokens". } */
  responses?: Partial<Record<"GET" | "POST" | "PATCH" | "PUT" | "DELETE", string>>;
  /**
   * Schema for the success payload.
   *
   * Where this is present the published document carries a real response schema
   * and the frontend's types are generated from it. Where it is absent the
   * generator falls back to prose and flags the operation
   * `x-response-schema-pending`, so the gap stays visible instead of being papered
   * over with an `any`.
   */
  response?: z.ZodTypeAny;
  /** Prose description of the success payload; omit when `response` is given. */
  dataShape?: string;
  deprecated?: boolean;
};

// ── Shared query fragments ───────────────────────────────────────────────────
const pagination = {
  page: z.coerce.number().int().positive().default(1).describe("1-based page number."),
  limit: z.coerce.number().int().positive().default(15).describe("Page size."),
};

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, "Expected YYYY-MM-DD")
  .describe("Calendar date in the clinic's timezone.");

const durationQuery = z.coerce
  .number()
  .int()
  .positive()
  .default(15)
  .describe("Appointment length in minutes.");

const ROUTES = {
  // ── Authentication ────────────────────────────────────────────────────────
  "POST /api/v1/auth/register": {
    summary: "Register a patient account",
    description:
      "Creates a self account with a pending email. The user is issued access and refresh tokens immediately; email verification is a separate step so the app stays usable if mail is delayed.",
    response: z.null(),
  },
  "POST /api/v1/auth/login": {
    summary: "Exchange credentials for tokens",
    description:
      "Returns an access token (short-lived) and a refresh token. Refresh tokens rotate: using one invalidates it, so concurrent refreshes must be single-flighted by the client.",
    response: authSessionSchema,
  },
  "POST /api/v1/auth/refresh": {
    summary: "Rotate a refresh token",
    description:
      "Issues a new pair and revokes the presented refresh token. Reusing a rotated token fails with 401.",
    response: refreshedAccessTokenSchema,
  },
  "POST /api/v1/auth/logout": {
    summary: "Revoke the current session",
    description: "Revokes the refresh token and evicts the account from the auth cache.",
    response: z.null(),
  },
  "PATCH /api/v1/auth/email": {
    summary: "Change the signed-in user's email",
    description: "Sends a verification code to the new address; it takes effect once verified.",
    response: z.null(),
  },
  "PATCH /api/v1/auth/phone": {
    summary: "Change the signed-in user's phone number",
    response: z.null(),
  },
  "PATCH /api/v1/auth/password": {
    summary: "Change the signed-in user's password",
    description: "Requires the current password. Revokes other sessions so a stolen token cannot outlive the change.",
    response: z.null(),
  },
  "POST /api/v1/auth/verify-email": {
    summary: "Verify an email address with a code",
    response: z.null(),
  },
  "POST /api/v1/auth/resend-verification": {
    summary: "Send another verification email",
    response: z.null(),
  },
  "POST /api/v1/auth/forgot-password": {
    summary: "Request a password reset email",
    description:
      "Always reports success, whether or not the address exists: a differing response would turn the endpoint into an account-enumeration oracle.",
    response: z.null(),
  },
  "POST /api/v1/auth/reset-password": {
    summary: "Set a new password with a reset token",
    description: "Consumes the token and revokes existing sessions.",
    response: z.null(),
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  "GET /api/v1/user/me": {
    summary: "Get the signed-in user's profile",
    response: ownProfileSchema,
  },
  "GET /api/v1/user/me/export": {
    summary: "Export the signed-in user's record as JSON",
    response: dataExportSchema,
    description:
      "A portability endpoint: everything the account holds about itself. Writes an audit row, because exporting a chart is exactly the event an access log exists to capture.",
  },
  "PATCH /api/v1/user/me/profile-image": {
    summary: "Upload or replace a profile photo",
    description: "Multipart upload stored on Cloudinary; replaces the previous image.",
    dataShape: "{ profileImageUrl }",
  },
  "GET /api/v1/user/me/family": {
    summary: "List dependents the user may act for",
    response: familyMemberSchema.array(),
    description:
      "Returns family members this account is a guardian of. This is the scope that `canActForPatient` checks, so it defines who a parent can book for.",
  },
  "POST /api/v1/user/me/family": {
    summary: "Create a dependent",
    response: familyMemberSchema,
    description: "Dependents have no login of their own and no email address.",
  },
  "POST /api/v1/user/me/family/add-by-code": {
    summary: "Claim a dependent with a share code",
    dataShape: "The dependent, now linked to this guardian.",
  },
  "GET /api/v1/user/doctors": {
    summary: "List doctors, optionally filtered",
    query: doctorsQuerySchema,
    response: doctorDirectoryEntrySchema.array(),
  },
  "GET /api/v1/user/patients": {
    summary: "List the patient directory",
    response: patientDirectoryEntrySchema.array(),
    description:
      "Paginated and searchable by prefix on name, email or phone. Served from a collation index, so it does not scan the collection.",
    query: patientDirectoryQuerySchema,
  },

  // ── Appointments ──────────────────────────────────────────────────────────
  "POST /api/v1/appointment": {
    summary: "Book an appointment",
    description:
      "A patient can hold only one live booking (pending or arrived) at a time. That rule is enforced both in the controller and by a partial unique index, so two concurrent submissions cannot both win.",
    dataShape: "The created appointment.",
  },
  "GET /api/v1/appointment": {
    summary: "List appointments",
    query: appointmentsQuerySchema,
    response: appointmentPageSchema,
  },
  "POST /api/v1/appointment/hold": {
    summary: "Reserve a slot temporarily",
    description:
      "The hold-then-confirm flow: a patient holds a slot, pays, and converts it to a booking. Holds expire on their own so an abandoned reservation cannot lock a slot forever.",
    dataShape: "The hold, including its expiry.",
  },
  "POST /api/v1/appointment/hold/{id}/book": {
    summary: "Convert a hold into a booking",
    description: "Fails if the hold expired or the slot was taken while it was held.",
    dataShape: "The created appointment.",
  },
  "DELETE /api/v1/appointment/hold/{id}": {
    summary: "Release a hold early",
    dataShape: "null",
  },
  "GET /api/v1/appointment/slots": {
    summary: "Get the clinic's configured time slots",
    description: "The slots come from clinic settings, so they are clinic data rather than a hardcoded list.",
    response: slotStateSchema.array(),
  },
  "GET /api/v1/appointment/available-slots": {
    summary: "List bookable slots for a doctor on a date",
    response: z.array(z.string()),
    query: slotStatesQuerySchema,
  },
  "GET /api/v1/appointment/active": {
    summary: "List the front desk's active queue",
    query: queueQuerySchema,
    response: appointmentQueueSchema,
  },
  "GET /api/v1/appointment/arrived": {
    summary: "List arrived patients waiting to be seen",
    query: arrivedQuerySchema,
    response: appointmentQueueSchema,
  },
  "GET /api/v1/appointment/today": {
    summary: "Get today's schedule",
    query: queueQuerySchema,
    response: appointmentQueueSchema,
  },
  "PATCH /api/v1/appointment/{id}/status": {
    summary: "Change an appointment's status",
    description:
      "Patients may only move an appointment to `cancelled`; the broader status set is front-desk and admin work. Doctors are excluded entirely.",
    dataShape: "The updated appointment.",
  },
  "PATCH /api/v1/appointment/{id}/reschedule": {
    summary: "Move an appointment to another slot",
    description: "Re-checks that the new slot is genuinely free rather than assuming the old check still holds.",
    dataShape: "The updated appointment.",
  },
  "GET /api/v1/appointment/{id}/ticket/qr": {
    summary: "Get the check-in QR code for an appointment",
    description: "A patient shows this at reception; staff check in by scanning or by ticket code.",
    dataShape: "{ ticketCode, qrDataUrl }",
  },
  "POST /api/v1/appointment/check-in": {
    summary: "Check a patient in by ticket",
    description:
      "Front desk only. Rate limited separately from booking, because it is the endpoint an attacker would target to fake arrival.\n\nIdempotent: scanning the same ticket twice succeeds with `alreadyCheckedIn: true` rather than an error, because a patient standing at the desk twice should not look like a fault.\n\nAlso writes an access-log entry, so \"what did this staff member do today?\" covers check-ins and not only chart reads.",
    response: checkInResultSchema,
  },

  // ── Consultations ─────────────────────────────────────────────────────────
  "POST /api/v1/consultation": {
    summary: "Write a consultation record",
    description:
      "Doctor-only, and the clinical write of the app. Creating one also completes the linked appointment and starts the follow-up clock.",
    dataShape: "The created consultation.",
  },
  "GET /api/v1/consultation": {
    summary: "List consultations",
    query: consultationsQuerySchema,
    response: consultationHistoryEntrySchema.array(),
  },
  "GET /api/v1/consultation/history/{patientId}": {
    summary: "Get a patient's medical history",
    description:
      "Owner or treating clinician only. Reading a chart writes an access-log row.",
    response: medicalHistorySchema,
  },
  "GET /api/v1/consultation/latest/{patientId}": {
    summary: "Get a patient's most recent consultation",
    response: consultationHistoryEntrySchema.nullable(),
  },
  "GET /api/v1/consultation/follow-ups": {
    summary: "List consultations with follow-ups outstanding",
    description: "The worklist behind the reminder job.",
    query: followUpsQuerySchema,
    response: followUpSchema.array(),
  },
  "PATCH /api/v1/consultation/{id}/follow-up": {
    summary: "Mark a follow-up complete or missed",
    dataShape: "The updated consultation.",
  },

  // ── Reports ───────────────────────────────────────────────────────────────
  "POST /api/v1/report": {
    summary: "Upload a report document",
    response: reportSchema,
    description:
      "Multipart upload (PDF or image). PDFs are stored in GridFS rather than Cloudinary, which rejects them on this account; images go to Cloudinary. Both paths write an access-log row.",
    multipart: z.object({
      patientId: z.string().describe("Patient the report belongs to."),
      title: z.string().describe("Human-readable title."),
      type: z.string().optional().describe("Report category, e.g. 'lab' or 'imaging'."),
      date: isoDate.optional().describe("Date on the document."),
      files: z
        .array(z.any())
        .describe("One or more files as multipart/form-data parts named `files`."),
    }),
  },
  "GET /api/v1/report": {
    summary: "List reports",
    response: reportListSchema,
    query: reportsQuerySchema,
  },
  "GET /api/v1/report/{id}/file/{index}": {
    summary: "Download or stream one file of a report",
    description:
      "Index rather than a file id, so a report's file list cannot be used to fetch an unrelated document. Requires the owner, the treating doctor, or staff; each download is logged.",
    dataShape: "Binary file stream or a redirect to its stored URL.",
  },

  // ── Reviews ───────────────────────────────────────────────────────────────
  "POST /api/v1/review": {
    summary: "Rate a doctor, or update your rating",
    response: reviewSchema,
    description:
      "Upsert, one review per patient per doctor. Eligibility requires a completed consultation, so reviews track real visits rather than anyone who can reach the endpoint.",
  },
  "DELETE /api/v1/review/{doctorId}": {
    summary: "Delete your review of a doctor",
    dataShape: "null",
  },
  "GET /api/v1/review": {
    summary: "List reviews",
    response: reviewListResponseSchema,
    query: reviewsQuerySchema,
  },

  // ── Doctor leave ──────────────────────────────────────────────────────────
  "POST /api/v1/leave/add": {
    summary: "File a leave request",
    description: "A doctor files their own leave; admins cannot file it on their behalf.",
    dataShape: "The created leave record.",
  },
  "GET /api/v1/leave/my": {
    summary: "List your own leave requests",
    response: z.array(leaveRecordSchema),
  },
  "DELETE /api/v1/leave/remove/{leaveId}": {
    summary: "Withdraw a leave request",
    dataShape: "null",
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  "GET /api/v1/notification": {
    summary: "List your notifications",
    response: notificationListSchema,
    query: notificationsQuerySchema,
  },
  "GET /api/v1/notification/unread-count": {
    summary: "Get the unread notification count",
    description:
      "Returns `{ unread }`. The field is named `unread`, not `count` — the response schema pins it so a client cannot guess.",
    response: z.object({ unread: z.number().int().nonnegative() }),
  },
  "PATCH /api/v1/notification/read-all": {
    summary: "Mark every notification read",
    response: z.null(),
  },
  "PATCH /api/v1/notification/{id}/read": {
    summary: "Mark one notification read",
    response: notificationSchema,
  },

  // ── Administration ────────────────────────────────────────────────────────
  "GET /api/v1/admin/stats": {
    summary: "Dashboard counters",
    response: adminStatsSchema,
  },
  "GET /api/v1/admin/analytics": {
    summary: "Clinic analytics",
    response: adminAnalyticsSchema,
  },
  "GET /api/v1/admin/users": {
    summary: "List all users of every role",
    response: z.array(userSummarySchema),
    query: adminUsersQuerySchema,
  },
  "PATCH /api/v1/admin/users/{id}/activate": {
    summary: "Activate or deactivate an account",
    description:
      "Deactivation takes effect within the auth cache TTL rather than instantly; the window is 30 seconds by design.",
    dataShape: "The updated user.",
  },
  "POST /api/v1/admin/team": {
    summary: "Add a staff, doctor or admin team member",
    description: "Admin only. Creates an account and invites it to verify its email.",
    dataShape: "{ user, inviteSent }",
  },
  "GET /api/v1/admin/export/appointments": {
    summary: "Export appointments as CSV",
    query: exportAppointmentsQuerySchema,
    dataShape: "A CSV attachment.",
  },
  "GET /api/v1/admin/export/patients": {
    summary: "Export patients as CSV",
    dataShape: "A CSV attachment.",
  },
  "GET /api/v1/admin/audit/activity": {
    summary: "Read the PHI access log",
    description:
      "Admin only, and deliberately not available to staff: the log records which clinician read which patient, which is itself sensitive.",
    query: auditActivityQuerySchema,
    response: accessLogPageSchema,
  },
  "GET /api/v1/admin/audit/patient/{patientId}": {
    summary: "Read who has accessed one patient's record",
    query: auditPatientQuerySchema,
    response: accessLogPageSchema,
  },
  "GET /api/v1/admin/audit/patient/{patientId}/by-staff": {
    summary: "Access log for one patient, restricted to staff activity",
    response: accessLogPageSchema,
  },
  "PUT /api/v1/admin/clinic-settings": {
    summary: "Update clinic settings",
    description:
      "Slot list, consultation duration and working hours. Changing these changes what every other endpoint accepts, so it is admin-only.",
    dataShape: "The updated clinic settings.",
  },
  "GET /api/v1/admin/clinic-blockouts": {
    summary: "List clinic-wide blackout dates",
    response: z.array(clinicBlockoutSchema),
    query: clinicBlockoutsQuerySchema,
  },
  "POST /api/v1/admin/clinic-blockouts": {
    summary: "Block out a date or range",
    description: "Blocks the clinic entirely, or one doctor, so slots stop being offered.",
    dataShape: "The created blockout.",
  },
  "DELETE /api/v1/admin/clinic-blockouts/{date}": {
    summary: "Remove a blackout",
    dataShape: "null",
  },

  // ── Clinic ────────────────────────────────────────────────────────────────
  "GET /api/v1/clinic/settings": {
    summary: "Get public clinic settings",
    response: publicClinicSettingsSchema,
    description:
      "Unauthenticated: the booking screen needs the slot list and opening hours before anyone can log in.",
  },

  // ── Remaining routes ──────────────────────────────────────────────────────
  "GET /api/v1/appointment/{id}": {
    summary: "Get one appointment",
    description: "Owner, the assigned doctor, or front desk.",
    response: appointmentSchema,
  },
  "DELETE /api/v1/report/{id}": {
    summary: "Delete a report",
    description:
      "Removes the report record and the documents behind it. Patient, staff or admin.",
    dataShape: "null",
  },
  "PATCH /api/v1/user/me/family/{id}": {
    summary: "Update a dependent's details",
    description: "Guardians only; the dependent has no account of their own to update.",
    dataShape: "The updated dependent.",
  },
  "DELETE /api/v1/user/me/family/{id}": {
    summary: "Remove a dependent from your family",
    description:
      "The creator may remove anyone; a co-guardian can only remove themselves, which is what the leave-family endpoint is for.",
    dataShape: "null",
  },
  "DELETE /api/v1/user/me/family/{id}/guardians/{guardianId}": {
    summary: "Remove a guardian from a dependent",
    description:
      "The dependent's creator strips other guardians; any guardian may remove only themselves.",
    dataShape: "null",
  },
  "POST /api/v1/user/me/family/{id}/leave": {
    summary: "Leave a dependent's family yourself",
    description:
      "Lets a co-guardian walk away without asking the creator, so a shared custody link cannot trap someone in it.",
    dataShape: "null",
  },
  "POST /api/v1/user/me/family/{id}/share-code": {
    summary: "Regenerate a dependent's share code",
    description:
      "Rotating the code revokes the old one, so it doubles as the way to undo a code that leaked.",
    response: shareCodeSchema,
  },
  "GET /api/v1/user/me/share-code": {
    summary: "Get the signed-in user's family share code",
    response: shareCodeSchema,
    description:
      "Generates one on first read, so accounts created before the feature still work.",
  },
} satisfies Record<string, RouteDoc>;

export const ROUTE_DOCS: Record<string, RouteDoc> = ROUTES;
