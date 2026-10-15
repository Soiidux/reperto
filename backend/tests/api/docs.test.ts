import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app";

/**
 * The documentation is only useful if it is actually served and actually
 * accurate. These tests hit the real endpoints rather than calling the
 * generator directly, so a wiring mistake (wrong mount path, a route that
 * shadows the docs) fails here instead of being discovered by a reader.
 */

describe("GET /api/v1/docs", () => {
  it("serves a rendered HTML reference", async () => {
    const res = await request(app).get("/api/v1/docs");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("<!doctype html>");
    // A page that cannot reach its own spec is not a reference.
    expect(res.text).toContain("./openapi.json");
  });

  it("loads no third-party script", async () => {
    // A health-data application should not pull a CDN bundle in for
    // documentation; the page is self-contained on purpose.
    const res = await request(app).get("/api/v1/docs");
    expect(res.text).not.toMatch(/<script[^>]+src=/i);
    expect(res.text).not.toMatch(/https?:\/\/[^"']*\.js/i);
  });

  it("states what the document does not cover", async () => {
    // The page must not imply complete documentation it does not have.
    const res = await request(app).get("/api/v1/docs");
    expect(res.text).toContain("not schema-validated");
    expect(res.text).toContain("documented but not validated");
  });
});

describe("GET /api/v1/docs/openapi.json", () => {
  it("serves an OpenAPI 3.1 document", async () => {
    const res = await request(app).get("/api/v1/docs/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(res.body.info.title).toBe("Reperto API");
    expect(res.body.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
  });

  it("is reachable without authentication", async () => {
    // A spec you must log in to read cannot be used to integrate with the API.
    const res = await request(app).get("/api/v1/docs/openapi.json");
    expect(res.status).toBe(200);
  });

  it("describes the whole API, not a curated subset", async () => {
    const res = await request(app).get("/api/v1/docs/openapi.json");
    const paths: string[] = Object.keys(res.body.paths);
    // Every mount in the app appears, so a new router cannot be forgotten.
    for (const prefix of [
      "/api/v1/auth",
      "/api/v1/user",
      "/api/v1/appointment",
      "/api/v1/consultation",
      "/api/v1/leave",
      "/api/v1/admin",
      "/api/v1/report",
      "/api/v1/review",
      "/api/v1/notification",
      "/api/v1/clinic",
    ]) {
      expect(
        paths.filter((p) => p === prefix || p.startsWith(`${prefix}/`)).length,
        `no path under ${prefix}`,
      ).toBeGreaterThan(0);
    }
  });

  it("reports coverage honestly rather than implying completeness", async () => {
    const res = await request(app).get("/api/v1/docs/openapi.json");
    const stats = res.body["x-documentation"];

    expect(stats.generatedFrom).toBe("live Express route stack");
    expect(stats.totalOperations).toBeGreaterThan(70);

    // Every route has a written summary; not every route has a real response
    // schema yet, and the document says so with the actual number rather than
    // rounding up to look complete.
    expect(stats.withHumanSummary).toBe(stats.totalOperations);
    expect(stats.withResponseSchema).toBeGreaterThan(0);
    expect(stats.withResponseSchema).toBeLessThanOrEqual(stats.totalOperations);
  });

  it("flags each operation that lacks a real response schema", async () => {
    const res = await request(app).get("/api/v1/docs/openapi.json");
    const ops = Object.entries<Record<string, any>>(res.body.paths).flatMap(
      ([, methods]) => Object.values(methods),
    );
    const pending = ops.filter((op: any) => op["x-response-schema-pending"]);
    const schematised = ops.filter((op: any) => !op["x-response-schema-pending"]);

    // The flag has to track reality exactly, or it is decoration.
    expect(schematised.length).toBe(res.body["x-documentation"].withResponseSchema);
    expect(pending.length).toBe(
      res.body["x-documentation"].totalOperations - schematised.length,
    );
    // A schematised operation really does carry a schema in `data`: an object
    // has `properties`, a list endpoint has `items`. A bare `{ description }`
    // means the payload is only described in prose.
    for (const op of schematised) {
      const data = op.responses["200"].content["application/json"].schema.properties.data;
      const isRealSchema = data && (data.properties || data.items);
      expect(isRealSchema, `${op.operationId} should carry a real data schema`).toBeTruthy();
    }

    // And the inverse: an unflagged operation's payload really is prose-only.
    for (const op of pending) {
      expect(
        op.responses["200"].content["application/json"].schema.properties.data,
        op.operationId,
      ).toHaveProperty("description");
    }
  });

  it("carries no real secrets or host credentials", async () => {
    const res = await request(app).get("/api/v1/docs/openapi.json");
    // Regression guard: the spec is public, so nothing resembling a live
    // connection string may end up in it.
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/mongodb(\+srv)?:\/\//i);
    expect(text).not.toMatch(/JWT_SECRET|api[_-]?key["']?\s*[:=]/i);
  });

  it("is also reachable on the deprecated unversioned path", async () => {
    // The compatibility shim covers it, so a client mid-migration can read the
    // spec from the path it was already using.
    const res = await request(app).get("/api/docs/openapi.json");
    expect(res.status).toBe(200);
    expect(res.headers.deprecation).toBe("true");
  });
});