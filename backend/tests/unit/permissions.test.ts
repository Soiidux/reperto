import { describe, expect, it } from "vitest";
import {
  PERMISSION_MATRIX,
  PERMISSIONS,
  ROLES,
  can,
  isFrontDesk,
  permissionsFor,
  type Permission,
  type Role,
} from "../../src/utils/permissions";

/**
 * The permission matrix is the artifact authorization review actually reads:
 * "what can a staff member do?". These lock the rules that must not drift.
 *
 * The permission *names* are asserted explicitly so that adding a capability
 * is a deliberate act: a new capability absent from this list fails the suite,
 * rather than silently granting access to whoever held it before.
 */

describe("permission matrix", () => {
  it("names every capability explicitly", () => {
    // Mirrors the intent of the old authorize(...) role lists. Changing a role
    // here is a security change and should be a conscious edit.
    const expected: Record<Permission, Role[]> = {
      "appointments:book": ["patient", "staff", "admin"],
      "appointments:hold": ["patient"],
      "appointments:check-in": ["staff", "admin"],
      "appointments:edit-status": ["patient", "staff", "admin"],
      "appointments:reschedule": ["patient", "doctor", "staff", "admin"],
      "appointments:read": ["patient", "doctor", "staff", "admin"],

      "consultations:create": ["doctor"],
      "consultations:read": ["patient", "doctor", "staff", "admin"],
      "consultations:manage-follow-up": ["doctor", "staff", "admin"],

      "reports:upload": ["patient", "staff", "admin"],
      "reports:delete": ["patient", "staff", "admin"],
      "reports:read": ["patient", "doctor", "staff", "admin"],

      "reviews:write": ["patient"],
      "reviews:delete": ["patient"],
      "reviews:read": ["patient", "doctor", "staff", "admin"],

      "patients:list": ["doctor", "staff", "admin"],
      "leave:manage": ["doctor"],

      "admin:manage": ["admin"],
      "audit:read": ["admin"],
    };

    for (const [permission, roles] of Object.entries(expected)) {
      expect(
        (PERMISSIONS as Record<string, Role[]>)[permission],
        `${permission} role list changed`,
      ).toEqual(roles);
    }

    // And nothing extra slipped in unasserted.
    expect(Object.keys(PERMISSIONS).sort()).toEqual(
      Object.keys(expected).sort(),
    );
  });

  it("never grants a capability to an unknown role", () => {
    for (const row of PERMISSION_MATRIX) {
      for (const role of row.roles) {
        expect(ROLES, `${row.permission} lists unknown role ${role}`).toContain(
          role,
        );
      }
    }
  });

  it("gives admin operational powers but no clinical or identity-bound ones", () => {
    // Admin runs the clinic; it does not practise medicine or act as a patient.
    // An admin writing a consultation, filing a doctor's leave, or rating a
    // doctor would be impersonation, not administration. This is deliberate
    // separation of duties, and it is the one place "admin is omnipotent"
    // would be the wrong rule.
    const identityBound: Permission[] = [
      "appointments:hold", // reserving a slot in the patient's own name
      "reviews:write",
      "reviews:delete", // writing/rating as a patient
      "consultations:create", // authoring clinical notes
      "leave:manage", // a doctor's own leave
    ];

    for (const permission of identityBound) {
      expect(
        can("admin", permission),
        `admin should not hold ${permission}`,
      ).toBe(false);
    }

    for (const permission of Object.keys(PERMISSIONS) as Permission[]) {
      if (identityBound.includes(permission)) continue;
      expect(can("admin", permission), `admin should hold ${permission}`).toBe(
        true,
      );
    }
  });

  it("does not let a patient reach administration or the audit trail", () => {
    expect(can("patient", "admin:manage")).toBe(false);
    // Staff can read patient records but not who read them: the audit log is
    // itself sensitive.
    expect(can("patient", "audit:read")).toBe(false);
    expect(can("staff", "audit:read")).toBe(false);
    expect(can("doctor", "audit:read")).toBe(false);
    expect(can("admin", "audit:read")).toBe(true);
  });

  it("excludes doctors from front-desk work", () => {
    // Deliberate product rules, not accidents.
    expect(can("doctor", "appointments:check-in")).toBe(false);
    expect(can("doctor", "reports:upload")).toBe(false);
    expect(can("doctor", "reviews:write")).toBe(false);
  });

  it("excludes non-doctors from clinical work", () => {
    expect(can("patient", "consultations:create")).toBe(false);
    expect(can("staff", "consultations:create")).toBe(false);
    expect(can("patient", "leave:manage")).toBe(false);
  });

  it("denies everyone for a missing role", () => {
    for (const permission of Object.keys(PERMISSIONS) as Permission[]) {
      expect(can(undefined, permission)).toBe(false);
      expect(can(null as unknown as string, permission)).toBe(false);
      expect(can("", permission)).toBe(false);
      expect(can("superuser", permission)).toBe(false);
    }
  });
});

describe("the matrix describes the API, not an intention", () => {
  it("marks which capabilities are open to every authenticated role", () => {
    // These read the weakest in the matrix: they exclude nobody, so they exist
    // to document that an endpoint is deliberately open to all roles rather
    // than to restrict anything. Worth naming, because they are the entries
    // most likely to be quietly dropped from the matrix as "pointless" — and
    // dropping them is what makes a matrix incomplete.
    const allRoles = Object.entries(PERMISSIONS)
      .filter(([, roles]) => roles.length === ROLES.length)
      .map(([permission]) => permission)
      .sort();

    expect(allRoles).toEqual([
      "appointments:read",
      "appointments:reschedule",
      "consultations:read",
      "reports:read",
      "reviews:read",
    ]);

    // The invariant that actually matters — that each of these is enforced by at
    // least one route — is checked against the live routes in openapi.test.ts.
  });
});

describe("can / permissionsFor", () => {
  it("answers per role", () => {
    expect(can("staff", "appointments:check-in")).toBe(true);
    expect(can("patient", "appointments:check-in")).toBe(false);
  });

  it("summarises a role's capabilities", () => {
    const staff = permissionsFor("staff");
    expect(staff).toContain("appointments:check-in");
    expect(staff).toContain("appointments:edit-status");
    expect(staff).not.toContain("admin:manage");
    expect(staff).not.toContain("reviews:write");
  });

  it("gives a patient the narrowest sensible set", () => {
    const patient = permissionsFor("patient");
    expect(patient).toContain("appointments:hold");
    expect(patient).not.toContain("appointments:check-in");
    expect(patient).not.toContain("consultations:create");
  });

  it("keeps a doctor's set clinical", () => {
    const doctor = permissionsFor("doctor");
    expect(doctor).toContain("consultations:create");
    expect(doctor).toContain("leave:manage");
    expect(doctor).not.toContain("appointments:check-in");
    expect(doctor).not.toContain("admin:manage");
  });
});

describe("isFrontDesk", () => {
  it("is exactly staff and admin", () => {
    expect(isFrontDesk("staff")).toBe(true);
    expect(isFrontDesk("admin")).toBe(true);
    expect(isFrontDesk("doctor")).toBe(false);
    expect(isFrontDesk("patient")).toBe(false);
    expect(isFrontDesk(undefined)).toBe(false);
  });
});