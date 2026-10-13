/**
 * Central permission matrix.
 *
 * Authorization used to be two things at once: a raw role list on each route
 * (`authorize("patient", "staff", "admin")`) and ad-hoc `req.user.role ===
 * "doctor"` comparisons scattered through controllers. Neither said *why* a
 * role was allowed, and neither could be read as a whole.
 *
 * Routes now declare a capability ("what this endpoint does") and the matrix
 * below is the single place that says which roles hold it. Reading
 * PERMISSION_MATRIX is meant to answer "what can a staff member do?" without
 * grepping.
 *
 * Rules of thumb when adding a permission:
 *   - Name it for the action, not the role ("reports:upload", not "staffOnly").
 *   - Put the role list here only; never repeat it at the call site.
 *   - Capability checks that also depend on *ownership* (this patient, this
 *     doctor) stay in the controller — a role matrix cannot express "your
 *     own record".
 */

export const ROLES = ["patient", "doctor", "staff", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = {
  // ── Appointments ─────────────────────────────────────────────────────────
  "appointments:book": ["patient", "staff", "admin"],
  /** The movie-style hold flow: patients reserve a slot themselves. */
  "appointments:hold": ["patient"],
  "appointments:check-in": ["staff", "admin"],
  /** Any-status editing. Doctors are deliberately excluded. */
  "appointments:edit-status": ["patient", "staff", "admin"],
  "appointments:reschedule": ["patient", "doctor", "staff", "admin"],
  "appointments:read": ["patient", "doctor", "staff", "admin"],

  // ── Consultations ───────────────────────────────────────────────────────
  "consultations:create": ["doctor"],
  "consultations:read": ["patient", "doctor", "staff", "admin"],
  "consultations:manage-follow-up": ["doctor", "staff", "admin"],

  // ── Reports (the patient's own document vault) ─────────────────────────
  "reports:upload": ["patient", "staff", "admin"],
  "reports:delete": ["patient", "staff", "admin"],
  "reports:read": ["patient", "doctor", "staff", "admin"],

  // ── Doctor reviews ──────────────────────────────────────────────────────
  /** Patients only; eligibility also requires a completed visit. */
  "reviews:write": ["patient"],
  "reviews:delete": ["patient"],
  "reviews:read": ["patient", "doctor", "staff", "admin"],

  // ── Directory ───────────────────────────────────────────────────────────
  "patients:list": ["doctor", "staff", "admin"],

  // ── Doctor leave ────────────────────────────────────────────────────────
  "leave:manage": ["doctor"],

  // ── Administration ──────────────────────────────────────────────────────
  "admin:manage": ["admin"],
  /**
   * Reading the PHI access audit. Staff can read patient records but not the
   * log of who read them: the audit is itself sensitive, because it exposes
   * which clinicians are looking at which patients.
   */
  "audit:read": ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

/** Whether a role holds a capability. */
export const can = (role: string | undefined, permission: Permission): boolean => {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
};

/** True for the roles that run the front desk (staff and admin). */
export const isFrontDesk = (role: string | undefined): boolean =>
  role === "staff" || role === "admin";

/**
 * Every capability a role holds — the "role matrix" in interview-question form.
 */
export const permissionsFor = (role: Role): Permission[] =>
  (Object.keys(PERMISSIONS) as Permission[]).filter((p) =>
    can(role, p),
  );

/**
 * The full matrix as rows, for documentation and for asserting it in tests.
 */
export const PERMISSION_MATRIX: {
  permission: Permission;
  roles: Role[];
}[] = (Object.keys(PERMISSIONS) as Permission[]).map((permission) => ({
  permission,
  roles: ROLES.filter((role) => can(role, permission)),
}));