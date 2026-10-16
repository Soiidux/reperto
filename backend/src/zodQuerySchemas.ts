import { z } from "zod";
import { objectId } from "./openapi/responseSchemas";

/**
 * Query-string schemas.
 *
 * Two jobs at once, which is the point of putting them here rather than
 * inline: `validate(schema, { source: "query" })` enforces them at runtime, and
 * `openapi/routeDocs.ts` publishes them. One definition, so the documented
 * query parameters and the enforced ones cannot disagree — the failure mode that
 * makes an API spec worse than no spec.
 *
 * Before this, every query string in the API was unvalidated and merely
 * described: the OpenAPI document carried `x-query-params-documented-only` on 17
 * operations, which is an honest admission that the server never checked them.
 *
 * ## Staying behaviour-compatible
 *
 * These schemas are deliberately shaped around what the controllers already
 * accepted, because turning on validation changes which requests succeed. Where
 * a controller coerced something odd rather than rejecting it, the schema
 * matches the controller:
 *
 *   - `limit: 0` was accepted and replaced by the default (`Number(x) || 15`),
 *     so the schemas accept 0 rather than demanding positive.
 *   - `?search=` was treated as "no filter", so an empty string is allowed.
 *   - `?status=all` is how the SPA says "no filter", so `all` is in the enum.
 *
 * Two enums (`role`, `isActive`) are *stricter* than before: the old code mapped
 * any unrecognised value to `false`/no-filter, so `?isActive=yes` silently meant
 * "inactive only" and returned a list that looked empty. Rejecting it is a
 * deliberate behaviour change, and a much better one.
 */

const objectIdString = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Expected a 24-character id")
  .describe("A user id.");

// ── Shared fragments ────────────────────────────────────────────────────────

/**
 * Page size. Zero is allowed because controllers treat it as "use the default"
 * (`Number(limit) || default`), and rejecting it would break callers that send
 * it today.
 */
const pageSize = (fallback: number) =>
  z.coerce
    .number()
    .int()
    .nonnegative()
    .default(fallback)
    .describe(`Page size. 0 means "use the server default" (${fallback}).`);

const pageNumber = z.coerce
  .number()
  .int()
  .positive()
  .default(1)
  .describe("1-based page number.");

/**
 * `YYYY-MM-DD`. Only the shape is checked here — `parseDateAnchor` already
 * rejects impossible calendar dates such as 2026-02-31, and duplicating that
 * rule in two places would be one more thing to keep in sync.
 */
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .describe("Calendar date in the clinic's timezone.");

/** Free-text prefix. Empty means "no filter", which is what the SPA sends. */
const searchTerm = z
  .string()
  .optional()
  .describe("Prefix of name, email or phone.");

const queueLimit = z.coerce
  .number()
  .int()
  .nonnegative()
  .optional()
  .describe("Cap the number of rows. 0 means the server default (50); the server caps at 200.");

export const appointmentStatusValues = [
  "pending",
  "arrived",
  "completed",
  "cancelled",
  "no-show",
] as const;

/**
 * `"all"` is the sentinel controllers already treat as "no filter"
 * (`if (status && status !== "all")`). Excluding it from the enum was a
 * regression when validation was switched on: the SPA sends `undefined`, but
 * the controller's own check proves callers send the literal string, and those
 * requests started failing with a 400.
 */
const appointmentStatus = z.enum([...appointmentStatusValues, "all" as const]);

// ── Appointments ────────────────────────────────────────────────────────────

export const appointmentsQuerySchema = z.object({
  page: pageNumber,
  limit: pageSize(50),
  status: appointmentStatus.optional().describe("Filter by status."),
  search: z.string().optional().describe("Filter by patient name or phone."),
  from: calendarDate.optional().describe("Earliest appointment date."),
  to: calendarDate.optional().describe("Latest appointment date."),
});

export const queueQuerySchema = z.object({ limit: queueLimit });

export const arrivedQuerySchema = z.object({
  scope: z
    .enum(["today", "all"])
    .optional()
    .describe('Restrict to today, or include every waiting patient. Defaults to "today".'),
  limit: queueLimit,
});

export const slotStatesQuerySchema = z.object({
  doctorId: objectIdString,
  date: calendarDate,
  durationInMinutes: z.coerce
    .number()
    .int()
    .positive()
    .default(15)
    .describe("Appointment length in minutes."),
});

// ── Consultations ───────────────────────────────────────────────────────────

export const consultationsQuerySchema = z.object({
  patientId: objectIdString.optional().describe("Filter to one patient."),
  appointmentId: objectIdString.optional().describe("Filter to one appointment."),
});

export const followUpsQuerySchema = z.object({
  status: z
    .enum(["pending", "completed", "missed"])
    .optional()
    .describe("Filter by follow-up state."),
  doctorId: objectIdString.optional().describe("Restrict to one doctor's patients."),
});

// ── Directory ───────────────────────────────────────────────────────────────

export const patientDirectoryQuerySchema = z.object({
  page: pageNumber,
  limit: pageSize(15),
  search: searchTerm,
});

export const adminUsersQuerySchema = z.object({
  page: pageNumber,
  limit: pageSize(15),
  search: searchTerm,
  role: z
    .enum(["all", "patient", "doctor", "staff", "admin"])
    .optional()
    .describe('Filter by role. "all" means no filter.'),
  // Stricter than before: the old code mapped any unrecognised value to
  // `false`, so `?isActive=yes` returned only deactivated accounts and looked
  // like an empty directory.
  isActive: z
    .enum(["true", "false", "all"])
    .optional()
    .describe('Account state. "all" means no filter.'),
});

export const doctorsQuerySchema = z.object({
  specialization: z.string().optional().describe("Specialty to filter by."),
  name: z.string().optional().describe("Case-insensitive prefix of the doctor's name."),
});

// ── Reports, reviews, notifications ─────────────────────────────────────────

/** `patientId` is required: the endpoint has no meaningful unscoped view. */
export const reportsQuerySchema = z.object({
  patientId: objectIdString.describe("Patient whose reports to list."),
});

export const reviewsQuerySchema = z.object({
  doctorId: objectId.optional().describe("Filter to one doctor."),
});

export const notificationsQuerySchema = z.object({
  limit: pageSize(30),
});

// ── Administration ──────────────────────────────────────────────────────────

export const auditActivityQuerySchema = z.object({
  actorId: objectIdString.optional().describe("Filter to one user id."),
  resource: z
    .enum(["consultation", "report", "medical-history", "appointment", "patient-profile"])
    .optional()
    .describe("Filter by resource type."),
  action: z
    .enum(["read", "create", "update", "delete", "export"])
    .optional()
    .describe("Filter by action."),
  limit: pageSize(100),
});

export const auditPatientQuerySchema = z.object({
  limit: pageSize(100),
});

export const clinicBlockoutsQuerySchema = z.object({
  from: calendarDate.optional(),
  to: calendarDate.optional(),
});

export const exportAppointmentsQuerySchema = z.object({
  from: calendarDate.optional(),
  to: calendarDate.optional(),
  status: appointmentStatus.optional(),
});