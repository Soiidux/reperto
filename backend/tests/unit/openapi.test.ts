import { describe, expect, it } from "vitest";
import { API_ROUTES } from "../../src/routes";
import { buildOpenApiDocument, discoverRoutes } from "../../src/openapi/generate";
import { ROUTE_DOCS } from "../../src/openapi/routeDocs";
import { PERMISSIONS, type Permission } from "../../src/utils/permissions";

/**
 * The OpenAPI document is generated from the live route stack, which only
 * prevents drift if something *checks* that it did. These tests are that
 * something: they would catch a guard that stopped being applied, a doc entry
 * left behind by a rename, or a body schema that quietly stopped validating.
 *
 * Every assertion here exists because its absence was a real bug once: see the
 * router-level-guard test, which reproduces the failure that initially made the
 * generator advertise the entire admin API as public.
 */

const routes = discoverRoutes(API_ROUTES);
const doc = buildOpenApiDocument({ mounts: API_ROUTES }) as any;
const ops = () =>
  Object.entries<Record<string, any>>(doc.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, op]) => ({ method: method.toUpperCase(), path, op })),
  );
const findOp = (method: string, path: string) =>
  ops().find((o) => o.method === method && o.path === path);

describe("route discovery", () => {
  it("finds every mounted route", () => {
    // 10 routers, 75 operations. A drop here means a whole file stopped being
    // scanned, which would silently delete it from the published spec.
    expect(routes.length).toBeGreaterThanOrEqual(75);
  });

  it("converts Express path params to OpenAPI braces", () => {
    const paths = routes.map((r) => r.openApiPath);
    expect(paths).toContain("/api/v1/appointment/{id}");
    expect(paths).toContain("/api/v1/report/{id}/file/{index}");
    // No raw ":param" should survive into the spec.
    for (const path of paths) expect(path).not.toMatch(/:/);
  });

  it("produces unique operation ids", () => {
    const ids = ops().map((o) => o.op.operationId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only emits methods that exist on the route", () => {
    for (const { method, op } of ops()) {
      expect(["GET", "POST", "PATCH", "PUT", "DELETE"]).toContain(method);
      expect(op.operationId.startsWith(method.toLowerCase())).toBe(true);
    }
  });
});

describe("authentication is read off the real guard", () => {
  it("marks genuinely public endpoints as unsecured", () => {
    for (const path of [
      "/api/v1/auth/login",
      "/api/v1/auth/register",
      "/api/v1/clinic/settings",
      "/api/v1/user/doctors",
    ]) {
      expect(findOp("GET", path) ?? findOp("POST", path), path).toBeDefined();
      const op = findOp("GET", path) ?? findOp("POST", path)!.op;
      expect(op.security, `${path} should be public`).toBeUndefined();
    }
  });

  it("marks protected endpoints as requiring a bearer token", () => {
    expect(findOp("GET", "/api/v1/user/me")!.op.security).toEqual([{ bearerAuth: [] }]);
  });

  it("applies router-level guards to every route in the router", () => {
    // The regression that motivated walking router-level middleware: admin.routes
    // guards the whole router with `router.use(protect, requirePermission(...))`,
    // which carries no path of its own. Reading only per-route handlers reported
    // all 14 admin endpoints as public.
    const adminOps = ops().filter((o) => o.path.startsWith("/api/v1/admin/"));
    expect(adminOps.length).toBeGreaterThanOrEqual(14);

    for (const { op, path } of adminOps) {
      expect(op.security, `${path} should require auth`).toEqual([{ bearerAuth: [] }]);
      expect(op.responses["401"], `${path} should document 401`).toBeDefined();
      expect(op.responses["403"], `${path} should document 403`).toBeDefined();
    }
  });

  it("prefers a route's own capability over the router's broader one", async () => {
    // Every admin route inherits admin:manage from the router, but the audit
    // endpoints declare audit:read — the capability that actually explains
    // them. The spec should say the specific thing.
    const auditOps = ops().filter((o) => o.path.includes("/admin/audit"));
    expect(auditOps.length).toBeGreaterThanOrEqual(3);
    for (const { op, path } of auditOps) {
      expect(op["x-required-permission"], path).toBe("audit:read");
      expect(op["x-permitted-roles"], path).toEqual(["admin"]);
    }

    const otherAdminOps = ops().filter(
      (o) => o.path.startsWith("/api/v1/admin/") && !o.path.includes("/audit"),
    );
    for (const { op, path } of otherAdminOps) {
      expect(op["x-required-permission"], path).toBe("admin:manage");
    }
  });

  it("gives every declared capability at least one route that enforces it", async () => {
    // The invariant that was missing: a capability can exist in the matrix
    // without any route using it, which makes the matrix a wish list rather
    // than a map of the API. That happened with seven capabilities, including
    // `appointments:edit-status` — the matrix stated a rule that the controller
    // independently reimplemented on an unguarded route.
    const enforced = new Set(
      ops()
        .map((o) => o.op["x-required-permission"])
        .filter(Boolean) as string[],
    );
    const declared = Object.keys(PERMISSIONS);
    const orphans = declared.filter((permission) => !enforced.has(permission));
    expect(
      orphans,
      `capabilities no route enforces: ${orphans.join(", ")}`,
    ).toEqual([]);
  });

  it("keeps self-service routes separate from role-differentiated ones", async () => {
    // Not every authenticated endpoint needs a capability. Acting on your own
    // account (/user/me, /auth/logout, family management) is available to every
    // role, so a matrix entry would say nothing. What matters is that these are
    // a known, deliberate set rather than routes that quietly differentiated on
    // role with no declaration.
    const selfService = ops()
      .filter((o) => o.op.security && !o.op["x-required-permission"])
      .map((o) => `${o.method} ${o.path}`)
      .sort();

    expect(selfService.every((entry) =>
      /\/(auth\/(email|phone|password|logout)|user\/me|notification)/.test(entry),
    ), `undocumented role-less authenticated routes: ${selfService.join(", ")}`)
      .toBe(true);
    expect(selfService.length).toBeGreaterThan(0);
  });

  it("applies router-level authentication to every route in the router", () => {
    // Notification routes have no per-route `protect` either.
    const notificationOps = ops().filter((o) => o.path.startsWith("/api/v1/notification"));
    expect(notificationOps.length).toBeGreaterThan(0);
    for (const { op, path } of notificationOps) {
      expect(op.security, `${path} should require auth`).toEqual([{ bearerAuth: [] }]);
    }
  });

  it("reports the capability the route actually enforces", () => {
    // Cross-checked against the permission matrix, so a typo in a capability
    // name cannot reach the published spec.
    const known = new Set(Object.keys(PERMISSIONS) as Permission[]);
    for (const { op, path } of ops()) {
      const permission = op["x-required-permission"];
      if (permission) {
        expect(known, `${path} claims unknown capability ${permission}`).toContain(
          permission,
        );
      }
    }
  });

  it("lists the roles behind each advertised capability", () => {
    for (const { op, path } of ops()) {
      const permission = op["x-required-permission"];
      if (!permission) continue;
      expect(op["x-permitted-roles"], `${path} should list roles`).toEqual(
        PERMISSIONS[permission as Permission],
      );
    }
  });
});

describe("request bodies come from the real validate() middleware", () => {
  it("publishes the body schema of routes that validate one", () => {
    const login = findOp("POST", "/api/v1/auth/login")!;
    expect(login.op.requestBody).toBeDefined();
    const schema = login.op.requestBody.content["application/json"].schema;
    // Derived from zod's own schema, so the field list cannot drift.
    expect(Object.keys(schema.properties).sort()).toEqual(["email", "password"]);
    expect(schema.required.sort()).toEqual(["email", "password"]);
  });

  it("omits a request body where there is none", () => {
    expect(findOp("GET", "/api/v1/appointment/today")!.op.requestBody).toBeUndefined();
  });

  it("advertises multipart for the report upload rather than JSON", () => {
    const upload = findOp("POST", "/api/v1/report")!;
    // The route uses multer, not a JSON body schema, so this comes from ROUTE_DOCS.
    expect(Object.keys(upload.op.requestBody.content)).toEqual(["multipart/form-data"]);
  });

  it("records which request parts are genuinely validated", () => {
    const login = findOp("POST", "/api/v1/auth/login")!;
    expect(login.op["x-validated-request-parts"]).toContain("body");
  });

  it("never claims a query string is validated when it is not", () => {
    // validate() only covered req.body historically. The document has to say so
    // rather than implying a guarantee the server does not make.
    const users = findOp("GET", "/api/v1/admin/users")!;
    expect(users.op["x-query-params-documented-only"]).toBe(true);
    expect(users.op["x-validated-request-parts"]).not.toContain("query");
  });

  it("documents the query parameters the controllers actually read", () => {
    const users = findOp("GET", "/api/v1/admin/users")!;
    const names = users.op.parameters.map((p: any) => p.name).sort();
    // from, to, status, limit, page, search, role, isActive — all read by
    // getAllUsers in admin.controllers.ts.
    expect(names).toEqual([
      "isActive",
      "limit",
      "page",
      "role",
      "search",
    ]);
    for (const param of users.op.parameters) expect(param.in).toBe("query");
  });

  it("marks path parameters required and typed", () => {
    const params = findOp("GET", "/api/v1/consultation/history/{patientId}")!.op.parameters;
    expect(params).toContainEqual({ name: "patientId", in: "path", required: true, schema: { type: "string" } });
  });
});

describe("documentation completeness", () => {
  it("has a human summary for every route", () => {
    const missing = routes.filter((r) => !r.doc?.summary).map((r) => `${r.method} ${r.openApiPath}`);
    // An auto-generated "Get users" fallback is not good enough for an endpoint
    // someone will read. Every route earns a written summary.
    expect(missing, `undocumented routes: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no doc entry pointing at a route that does not exist", () => {
    // A renamed or deleted route would otherwise leave its documentation
    // describing an endpoint that is no longer served.
    const live = new Set(routes.map((r) => `${r.method} ${r.openApiPath}`));
    const orphans = Object.keys(ROUTE_DOCS).filter((key) => !live.has(key));
    expect(orphans, `orphaned doc entries: ${orphans.join(", ")}`).toEqual([]);
  });

  it("describes the response payload for every route", () => {
    const pending = routes
      .filter((r) => !r.doc?.dataShape)
      .map((r) => `${r.method} ${r.openApiPath}`);
    expect(pending, `response shape missing: ${pending.join(", ")}`).toEqual([]);
  });

  it("reports coverage in the document itself", () => {
    expect(doc["x-documentation"]).toMatchObject({
      totalOperations: routes.length,
      generatedFrom: "live Express route stack",
    });
    expect(doc["x-documentation"].withHumanSummary).toBe(routes.length);
  });

  it("states its own limits in the info block", () => {
    // A specification that does not admit what it omits is the failure mode
    // this whole approach exists to avoid.
    expect(doc.info.description).toContain("not schema-validated");
    expect(doc.info.description).toContain("documented, not enforced");
  });
});

describe("document shape", () => {
  it("is a valid OpenAPI 3.1 envelope", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info.title).toBe("Reperto API");
    expect(doc.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(Array.isArray(doc.servers)).toBe(true);
  });

  it("declares every bearerAuth scheme it references", () => {
    expect(doc.components.securitySchemes.bearerAuth).toBeDefined();
  });

  it("gives every operation a 200 response", () => {
    for (const { op, path } of ops()) {
      expect(op.responses["200"], path).toBeDefined();
    }
  });

  it("tags every operation and lists each tag once", () => {
    for (const { op, path } of ops()) expect(op.tags?.[0], path).toBeTruthy();
    const tagNames = doc.tags.map((t: any) => t.name);
    expect(new Set(tagNames).size).toBe(tagNames.length);
  });

  it("never describes itself", () => {
    // docs.routes is mounted outside API_ROUTES on purpose.
    expect(routes.some((r) => r.openApiPath.includes("/docs"))).toBe(false);
  });
});