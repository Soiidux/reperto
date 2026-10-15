import { describe, expect, it } from "vitest";
import { z } from "zod";
import request from "supertest";
import express, { type Request, type Response, type NextFunction } from "express";
import { validate } from "../../src/middlewares/validate";

/**
 * validate() historically checked req.body and nothing else. That was fine as
 * long as no documentation claimed otherwise — but generating an OpenAPI
 * document from it would have published a spec that described request bodies
 * while silently omitting every query and path parameter. A spec that looks
 * complete and does not mention half the input is worse than no spec.
 *
 * These lock the source handling, including the Express 5 constraint that made
 * query validation a partial rather than a rewrite.
 */

const app = (middleware: ReturnType<typeof validate>) => {
  const server = express();
  // The real app parses JSON before validating; mirror that, or req.body is
  // undefined and every body test fails for the wrong reason.
  server.use(express.json());
  server.get("/probe", middleware, (req: Request, res: Response) => {
    res.json({ ok: true, validated: (req as any).validated ?? null });
  });
  server.post("/probe", middleware, (req: Request, res: Response) => {
    res.json({ ok: true, body: req.body });
  });
  return server;
};

const bodySchema = z.object({ name: z.string().min(1), age: z.coerce.number() });

describe("validate middleware metadata", () => {
  it("exposes the schema and source so the generator can read them", () => {
    // Without these markers the OpenAPI generator cannot see the schema at all.
    const middleware = validate(bodySchema);
    expect(middleware.zodSchema).toBe(bodySchema);
    expect(middleware.validateSource).toBe("body");
  });

  it("defaults to body, so every pre-existing call site is unchanged", () => {
    expect(validate(bodySchema).validateSource).toBe("body");
  });

  it("records the requested source", () => {
    expect(validate(bodySchema, { source: "query" }).validateSource).toBe("query");
    expect(validate(bodySchema, { source: "params" }).validateSource).toBe("params");
  });
});

describe("body validation (existing behaviour)", () => {
  it("rejects an invalid body with field errors", async () => {
    const res = await request(app(validate(bodySchema))).post("/probe").send({ name: "" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors.name).toBeDefined();
  });

  it("coerces and rewrites the parsed body, which controllers rely on", async () => {
    const res = await request(app(validate(bodySchema)))
      .post("/probe")
      .send({ name: "Ada", age: "36" });
    expect(res.status).toBe(200);
    // age arrives as a string over the wire and must reach the handler as a number.
    expect(res.body.body.age).toBe(36);
  });

  it("strips unknown keys", async () => {
    const res = await request(app(validate(bodySchema)))
      .post("/probe")
      .send({ name: "Ada", age: 1, isAdmin: true });
    expect(res.body.body).toEqual({ name: "Ada", age: 1 });
  });

  it("names the source even for a body, which is additive to the old shape", async () => {
    // Existing clients read `message` and `errors`; adding `source` widens the
    // response rather than changing it, and it saves a client guessing which
    // half of the request was rejected.
    const res = await request(app(validate(bodySchema))).post("/probe").send({});
    expect(res.status).toBe(400);
    expect(res.body.source).toBe("body");
    expect(res.body.message).toBe("Invalid request data");
    expect(res.body.errors).toBeDefined();
  });
});

describe("query validation", () => {
  const querySchema = z.object({
    page: z.coerce.number().int().positive(),
    limit: z.coerce.number().int().max(100),
  });

  it("accepts a valid query string", async () => {
    const res = await request(app(validate(querySchema, { source: "query" }))).get(
      "/probe?page=2&limit=10",
    );
    expect(res.status).toBe(200);
  });

  it("rejects an out-of-range value", async () => {
    const res = await request(app(validate(querySchema, { source: "query" }))).get(
      "/probe?page=2&limit=1000",
    );
    expect(res.status).toBe(400);
    expect(res.body.errors.limit).toBeDefined();
  });

  it("rejects a non-numeric value that would otherwise silently become NaN", async () => {
    const res = await request(app(validate(querySchema, { source: "query" }))).get(
      "/probe?page=abc",
    );
    expect(res.status).toBe(400);
  });

  it("names the source in the error, so a client knows which part was rejected", async () => {
    const res = await request(app(validate(querySchema, { source: "query" }))).get(
      "/probe?limit=0",
    );
    expect(res.body.source).toBe("query");
  });

  it("exposes the coerced result on req.validated rather than rewriting req.query", async () => {
    // Express 5 makes req.query a getter-only property, so assigning to it
    // throws. The parsed copy is offered separately instead.
    const res = await request(app(validate(querySchema, { source: "query" }))).get(
      "/probe?page=3&limit=5",
    );
    expect(res.status).toBe(200);
    expect(res.body.validated.query).toEqual({ page: 3, limit: 5 });
  });

  it("ignores the body entirely, so a POST body cannot satisfy a query schema", async () => {
    const res = await request(app(validate(querySchema, { source: "query" })))
      .post("/probe")
      .send({ page: 1, limit: 1 });
    expect(res.status).toBe(400);
  });
});

describe("param validation", () => {
  const paramsSchema = z.object({ patientId: z.string().regex(/^[a-f0-9]{24}$/i) });

  const paramApp = () => {
    const server = express();
    server.get(
      "/patient/:patientId",
      validate(paramsSchema, { source: "params" }),
      (req: Request, res: Response) =>
        res.json({ validated: (req as any).validated?.params }),
    );
    return server;
  };

  it("accepts a well-formed id", async () => {
    const id = "a".repeat(24);
    const res = await request(paramApp()).get(`/patient/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.validated).toEqual({ patientId: id });
  });

  it("rejects a malformed id before the controller runs", async () => {
    const res = await request(paramApp()).get("/patient/not-an-id");
    expect(res.status).toBe(400);
    expect(res.body.errors.patientId).toBeDefined();
  });
});