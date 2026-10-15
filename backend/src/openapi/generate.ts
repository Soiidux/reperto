import { z } from "zod";
import type { Router } from "express";
import { AUTH_REQUIRED } from "../middlewares/auth.middlewares";
import type { Permission } from "../utils/permissions";
import { PERMISSIONS } from "../utils/permissions";
import type { ValidateMiddleware, ValidateSource } from "../middlewares/validate";
import { ROUTE_DOCS, type RouteDoc } from "./routeDocs";

/**
 * OpenAPI 3.1 generation, driven by the *live* Express route stack.
 *
 * The design constraint that shaped this: a specification that is maintained by
 * hand next to the routes will eventually lie. It will describe a query
 * parameter the controller stopped reading, or claim a capability a route no
 * longer enforces, and nothing will notice because nothing compares the two.
 *
 * So paths, methods, authentication requirements, capabilities and request
 * body schemas are all *read off the middleware that actually runs*:
 *
 *   - path/method           from the router objects app.ts mounts
 *   - authentication        from the AUTH_REQUIRED marker on `protect`
 *   - required capability   from the marker on `requirePermission`
 *   - request body schema   from the marker on `validate()`
 *
 * Adding a guard or a schema to a route changes the published spec with no
 * second edit. Only things a route cannot declare on its own — prose summaries
 * and query parameters, which the validate() middleware historically ignored —
 * come from ROUTE_DOCS, and tests/unit/openapi.test.ts asserts every entry
 * there corresponds to a real route.
 */

export type JsonSchema = Record<string, unknown>;

const API_VERSION = process.env.API_VERSION || "v1";
const BASE_PATH = `/api/${API_VERSION}`;

/** Escape an Express 5 path pattern into OpenAPI's `{param}` syntax. */
const toOpenApiPath = (expressPath: string): string =>
  expressPath
    // Express 5 encodes optional segments as `/foo{/:bar}`; OpenAPI has no
    // optional-path concept, so the braces go and the segment becomes a plain
    // (required-looking) parameter.
    .replace(/\{\/:([^}]+)\}/g, "/{$1}")
    .replace(/:([A-Za-z0-9_]+)/g, "{$1}");

/** `/appointment/:id/status` -> `/api/v1/appointment/{id}/status` */
const joinPath = (prefix: string, routePath: string): string => {
  const tail = toOpenApiPath(routePath);
  const joined = `${BASE_PATH}${prefix}${tail === "/" ? "" : tail}`;
  return joined.replace(/\/+$/, "") || "/";
};

/**
 * Turn `GET /users/:patientId` into "Get users by patientId".
 *
 * A fallback, not a substitute for writing something meaningful: it exists so
 * an undocumented endpoint still gets a readable label instead of a blank, and
 * so the coverage report below is easy to read.
 */
const humanize = (method: string, openApiPath: string): string => {
  const segments = openApiPath
    .replace(BASE_PATH, "")
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/[{}]/g, "").replace(/[-_]/g, " "));

  const last = segments[segments.length - 1] ?? "";
  const rest = segments.slice(0, -1).join(" ");
  const verbs: Record<string, string> = {
    GET: "Get",
    POST: "Create",
    PATCH: "Update",
    PUT: "Replace",
    DELETE: "Delete",
  };
  const verb = verbs[method] ?? method;
  const subject = last === rest ? last : `${last} for ${rest}`;
  return `${verb} ${subject}`.replace(/\s+/g, " ").trim();
};

/** Operation ids must be unique and stable; derive from the canonical path. */
const operationId = (method: string, openApiPath: string): string =>
  `${method.toLowerCase()}_${openApiPath
    .replace(BASE_PATH, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")}`;

const zodToJsonSchema = (schema: z.ZodTypeAny, io: "input" | "output"): JsonSchema => {
  try {
    // OpenAPI 3.1 is a superset of JSON Schema 2020-12, so Zod v4's native
    // conversion emits something directly usable.
    return z.toJSONSchema(schema, {
      target: "draft-2020-12",
      io,
      // Inline everything: a consumer reading the spec should not have to chase
      // $defs by hand to find out what a field looks like.
      reused: "inline",
    }) as JsonSchema;
  } catch {
    // A schema using a transform Zod cannot express as JSON Schema must not
    // take down the whole document.
    return { type: "object", description: "Schema not representable as JSON Schema." };
  }
};

/** Minimal Express route layer shape, declared locally to avoid router internals. */
type RouteLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: unknown }[];
  };
};
type RouterLayer = { handle?: { stack?: unknown[] } };

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

/** Metadata a single middleware contributes to the spec. */
type MiddlewareMeta = {
  requiresAuth: boolean;
  permission?: Permission;
  schemas: Partial<Record<ValidateSource, z.ZodTypeAny>>;
};

const readMiddlewareMeta = (handle: unknown): MiddlewareMeta => {
  const h = handle as Record<symbol, unknown> & {
    permission?: Permission;
    zodSchema?: z.ZodTypeAny;
    validateSource?: ValidateSource;
  };
  const schemas: MiddlewareMeta["schemas"] = {};
  if (h?.zodSchema && h?.validateSource) schemas[h.validateSource] = h.zodSchema;
  return {
    requiresAuth: Boolean(h?.[AUTH_REQUIRED]),
    permission: h?.permission,
    schemas,
  };
};

const mergeMeta = (into: MiddlewareMeta, from: MiddlewareMeta): MiddlewareMeta => ({
  requiresAuth: into.requiresAuth || from.requiresAuth,
  // The most specific guard wins: a route-level capability overrides the
  // router's broader one.
  permission: from.permission ?? into.permission,
  schemas: { ...into.schemas, ...from.schemas },
});

type DiscoveredRoute = {
  method: string;
  openApiPath: string;
  tag: string;
  requiresAuth: boolean;
  permission?: Permission;
  /** Which request parts carry a zod schema, and which schema. */
  schemas: Partial<Record<ValidateSource, z.ZodTypeAny>>;
  /** Whether the generated spec is complete or a documented guess. */
  doc?: RouteDoc;
};

/**
 * Walk the routers app.ts mounts and collect everything the spec needs.
 *
 * Express 5 compiles mount paths into regexps rather than exposing them on the
 * layer, which is why the prefix comes from API_ROUTES instead of being parsed
 * back out of `layer.regexp`.
 *
 * Router-level middleware is the subtle part. `router.use(protect,
 * requirePermission("admin:manage"))` at the top of a router guards every route
 * in it, but shows up in the stack as an entry *before* any route, carrying no
 * path of its own. Reading only per-route handlers would therefore report all
 * 14 admin endpoints as unauthenticated — a published specification telling
 * consumers the administrative API is public.
 *
 * So the stack is walked in order, accumulating metadata from path-less layers
 * and applying the accumulated set to each route that follows, which is exactly
 * what Express does at runtime.
 */
export const discoverRoutes = (
  mounts: { prefix: string; router: Router; tag: string }[],
): DiscoveredRoute[] => {
  const discovered: DiscoveredRoute[] = [];

  for (const { prefix, router, tag } of mounts) {
    const stack: RouterLayer[] = (router as unknown as { stack?: RouterLayer[] }).stack ?? [];
    let inherited: MiddlewareMeta = { requiresAuth: false, schemas: {} };

    for (const layer of stack as (RouterLayer & RouteLayer)[]) {
      if (!layer.route) {
        // Router-level middleware, applying to every route after it.
        if (typeof layer.handle === "function") {
          inherited = mergeMeta(inherited, readMiddlewareMeta(layer.handle));
        }
        continue;
      }

      const openApiPath = joinPath(prefix, layer.route.path);
      const docKey = `${Object.keys(layer.route.methods)[0]?.toUpperCase() ?? ""} ${openApiPath}`;

      let meta: MiddlewareMeta = { requiresAuth: false, schemas: {} };
      for (const handlerLayer of layer.route.stack) {
        meta = mergeMeta(meta, readMiddlewareMeta(handlerLayer.handle));
      }
      meta = mergeMeta(inherited, meta);

      for (const method of HTTP_METHODS) {
        if (!layer.route.methods[method]) continue;
        discovered.push({
          method: method.toUpperCase(),
          openApiPath,
          tag,
          requiresAuth: meta.requiresAuth,
          permission: meta.permission,
          schemas: meta.schemas,
          doc: ROUTE_DOCS[docKey],
        });
      }
    }
  }

  return discovered.sort(
    (a, b) => a.openApiPath.localeCompare(b.openApiPath) || a.method.localeCompare(b.method),
  );
};

/** The envelope every endpoint in this API returns. */
const responseEnvelope = (dataSchema: JsonSchema): JsonSchema => ({
  type: "object",
  required: ["success", "message", "data"],
  properties: {
    success: { type: "boolean", description: "Always true; failures use a 4xx/5xx status." },
    message: { type: "string" },
    data: dataSchema,
  },
});

const errorEnvelope = (description: string): JsonSchema => ({
  type: "object",
  required: ["success", "message"],
  properties: {
    success: { type: "boolean", enum: [false] },
    message: { type: "string", description },
  },
});

export type OpenApiOptions = {
  mounts: { prefix: string; router: Router; tag: string }[];
  /** Overridable so tests can pin a version. */
  version?: string;
};

export const buildOpenApiDocument = ({ mounts, version }: OpenApiOptions) => {
  const routes = discoverRoutes(mounts);

  const paths: Record<string, Record<string, unknown>> = {};
  const componentsSchemas: Record<string, JsonSchema> = {};

  for (const route of routes) {
    const { method, openApiPath, tag, requiresAuth, permission, schemas, doc } = route;

    const parameters: JsonSchema[] = [];
    const validatedSources: string[] = [];

    // Path parameters, always present, always required.
    // An exec loop rather than String.matchAll: this project's tsconfig sets
    // no compiler target, so iterators are not downlevelled.
    const pathParamPattern = /\{([^}]+)\}/g;
    let pathParam: RegExpExecArray | null;
    while ((pathParam = pathParamPattern.exec(openApiPath)) !== null) {
      parameters.push({
        name: pathParam[1],
        in: "path",
        required: true,
        schema: { type: "string" },
      });
    }

    // Query parameters. validate() historically ignored the query string, so
    // most of these are documented but not enforced; the spec says which, so a
    // consumer can tell a guarantee from a description.
    if (doc?.query) {
      const querySchema = zodToJsonSchema(doc.query, "input");
      const properties = (querySchema.properties ?? {}) as Record<string, JsonSchema>;
      const required = new Set((querySchema.required as string[] | undefined) ?? []);
      for (const [name, schema] of Object.entries(properties)) {
        parameters.push({ name, in: "query", required: required.has(name), schema });
      }
      if (schemas.query) validatedSources.push("query");
    }

    const requestBody =
      schemas.body && (method === "POST" || method === "PUT" || method === "PATCH")
        ? {
            required: true,
            content: {
              "application/json": { schema: zodToJsonSchema(schemas.body, "input") },
            },
          }
        : undefined;

    if (schemas.body) validatedSources.push("body");

    // Report uploads are multipart, not JSON.
    const uploadBody =
      doc?.multipart && method === "POST"
        ? {
            required: true,
            content: {
              "multipart/form-data": {
                schema: zodToJsonSchema(doc.multipart, "input"),
              },
            },
          }
        : undefined;

    const dataSchema = doc?.response
      ? zodToJsonSchema(doc.response, "output")
      : { description: doc?.dataShape ?? "Endpoint-specific payload." };

    const responses: Record<string, unknown> = {
      "200": {
        description: doc?.responses?.[method] ?? "Successful response.",
        content: {
          "application/json": {
            schema: responseEnvelope(dataSchema),
          },
        },
      },
    };

    if (requiresAuth) {
      responses["401"] = {
        description: "Missing, invalid or expired access token.",
        content: { "application/json": { schema: errorEnvelope("Invalid token") } },
      };
    }
    if (permission) {
      responses["403"] = {
        description: `Authenticated but lacks the \`${permission}\` capability.`,
        content: { "application/json": { schema: errorEnvelope("Forbidden") } },
      };
    }
    if (schemas.body || doc?.query) {
      responses["400"] = {
        description: "Request failed schema validation.",
        content: { "application/json": { schema: errorEnvelope("Invalid request data") } },
      };
    }

    const operation: Record<string, unknown> = {
      operationId: operationId(method, openApiPath),
      summary: doc?.summary ?? humanize(method, openApiPath),
      tags: [tag],
      responses,
    };

    if (doc?.description) operation.description = doc.description;
    if (doc?.deprecated) operation.deprecated = true;
    if (parameters.length) operation.parameters = parameters;
    if (requestBody) operation.requestBody = requestBody;
    if (uploadBody) operation.requestBody = uploadBody;

    if (requiresAuth) {
      operation.security = [{ bearerAuth: [] }];
    }

    // Honest metadata rather than implied completeness: these endpoints have
    // request schemas but no response schemas yet, and query params that are
    // described rather than enforced.
    operation["x-validated-request-parts"] = validatedSources;
    if (permission) {
      operation["x-required-permission"] = permission;
      // Inline the roles too, so a consumer reading only the operation (which is
      // what Swagger UI and most generators show) still learns who may call it
      // without having to open PERMISSIONS.
      operation["x-permitted-roles"] = PERMISSIONS[permission];
    }
    if (doc?.query && !schemas.query) operation["x-query-params-documented-only"] = true;
    if (!doc?.response) operation["x-response-schema-pending"] = true;

    paths[openApiPath] = paths[openApiPath] ?? {};
    paths[openApiPath][method.toLowerCase()] = operation;
  }

  const documented = routes.filter((r) => r.doc?.summary).length;

  return {
    openapi: "3.1.0",
    info: {
      title: "Reperto API",
      version: version ?? "1.0.0",
      description: [
        "Clinic management API for Reperto: appointments, consultations,",
        "reports, reviews, notifications and administration.",
        "",
        "## How this document is produced",
        "",
        "Paths, methods, authentication, required capabilities and request",
        "body schemas are read directly from the Express middleware stack that",
        "serves the routes, so they cannot drift from the running API.",
        "",
        "## What this document does not claim",
        "",
        "- **Response bodies are not schema-validated.** `x-response-schema-pending`",
        "  marks an operation whose success payload is described only by prose.",
        "- **Query parameters are usually documented, not enforced.**",
        "  `x-query-params-documented-only` marks an operation whose query string",
        "  is described here but not validated at runtime. Check",
        "  `x-validated-request-parts` for the parts a zod schema really guards.",
        "- **Capabilities come from the route guard, not from ownership.** Whether",
        "  you may act on a *particular* patient or doctor is decided in the",
        "  controller; see docs/authorization.md.",
      ].join("\n"),
      license: { name: "MIT" },
    },
    servers: [
      { url: `http://localhost:5000${BASE_PATH}`, description: "Local development" },
      { url: BASE_PATH, description: "Same origin as the served SPA" },
    ],
    tags: [
      ...Array.from(new Set(routes.map((r) => r.tag))).map((name) => ({ name })),
    ].sort((a, b) => a.name.localeCompare(b.name)),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Access token from POST /auth/login. Short-lived; refresh via POST /auth/refresh.",
        },
      },
      schemas: componentsSchemas,
    },
    // Surfaced so tooling (and reviewers) can see coverage at a glance rather
    // than having to diff against the route files.
    "x-documentation": {
      totalOperations: routes.length,
      withHumanSummary: documented,
      withResponseSchema: routes.filter((r) => r.doc?.response).length,
      generatedFrom: "live Express route stack",
    },
  };
};