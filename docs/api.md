# API reference

The API documents itself at **`/api/v1/docs`** while the server is running.
The machine-readable contract is at `/api/v1/docs/openapi.json`.

```
docker compose up --build     # then open http://localhost:5000/api/v1/docs
```

## How it is generated

The specification is **not** maintained by hand. It is built by walking the
Express routers the server actually mounts, and reading metadata off the
middleware that serves each route:

| Documented from | Source |
|---|---|
| Paths and methods | the router objects in `backend/src/routes/index.ts` |
| Authentication requirement | a marker on the `protect` middleware |
| Required capability | a marker on `requirePermission(...)` |
| Request body schema | a marker on `validate(...)`, converted with Zod v4's `z.toJSONSchema` |
| 401 / 400 / 403 responses | inferred from which of the above are present |
| Query parameters, prose | `backend/src/openapi/routeDocs.ts` — the only hand-written part |

This matters because the usual outcome of hand-written API docs is that they
quietly stop matching reality. Here, adding a guard or a schema to a route
changes the published document in the same commit, because there is nothing
else to update.

### The bug this design was built around

The first version of the generator read only per-route handlers, and reported
**all 14 admin endpoints as public**. `admin.routes.ts` protects its whole
router with:

```ts
router.use(protect, requirePermission("admin:manage"));
```

That middleware carries no path of its own, so a naive walk missed it — and the
published specification told consumers the entire administrative API was
unauthenticated. The generator now walks the stack in order and accumulates
path-less layers, which is what Express itself does at runtime.
`tests/unit/openapi.test.ts` pins that behaviour specifically.

## What the document does not claim

A specification that overstates its own coverage is worse than none, so the
generated document declares its limits in two ways:

- **`x-query-params-documented-only`** — the query string is described here but
  **not validated** at runtime. `validate()` historically checked only
  `req.body`; it now supports `query` and `params` sources, but most routes have
  not opted in yet.
- **`x-response-schema-pending`** — the success payload is described in prose
  rather than as a schema. 13 of 75 operations have a real response schema
  today; the rest are marked.

`x-validated-request-parts` lists the parts a Zod schema genuinely guards, and
`x-documentation` at the document root reports total operations, how many have
a written summary, and how many have a *schema* response — so coverage is
visible at a glance instead of having to be diffed by hand. A test asserts the
per-operation markers agree with that headline number, so neither can drift
into decoration.

Every route also carries `x-required-permission` and `x-permitted-roles`, read
from the same `PERMISSIONS` matrix the server enforces. They cannot disagree.
See [authorization.md](./authorization.md) for what the matrix deliberately
cannot express.

## Response schemas, and why they are verified

`backend/src/openapi/responseSchemas.ts` describes what the API returns for the
core entities. These are **verified against live responses** in
`tests/api/responseSchemas.test.ts`, and that is not ceremony.

The first draft of that file described notifications with `userId`, `message` and
`read`, and a nine-value type enum. It looked entirely plausible and typechecked
cleanly. The real model has always used `recipientId`, `body` and `readAt` with
four types — so the schema would have rejected every genuine notification. Three
more of the same kind turned up while writing the rest:

- the public clinic settings endpoint was described as the internal
  `ClinicSettings` document; it actually returns a projected view with no `_id`
- `day` was assumed to be a weekday name; it is a 0–6 index
- the patient directory was assumed to include `role`; its projection omits it

Each was caught by parsing a real response rather than by reading the code,
which is the argument for verifying response schemas instead of trusting them
because they look right.

## Types shared with the frontend

The published document is also the source of the frontend's API types:

```
cd backend && npm run generate:types
```

writes `frontend/src/types/api.generated.ts`. Deriving them from the *published*
contract means they cannot describe an endpoint the API does not serve.

This replaces hand-written interfaces (`Review`, `ReportFile`, `Notification`,
`ReviewSummary`). Those were mostly correct, but nothing connected them to the
server, so a renamed field would keep compiling in the client and surface as
`undefined` at runtime. Stale generated types compile perfectly too, so:

- `tests/unit/generateTypes.test.ts` fails if the file is out of date, and says
  which command to run
- CI regenerates it and fails if the working tree changes

## Why the viewer is hand-written HTML

A React or Swagger UI bundle would mean shipping a third-party script into an
application that handles patient data, for a convenience feature. The page is
self-contained, loads no external resource, and degrades to readable text if the
spec cannot be fetched. A test asserts no `<script src>` is ever introduced.

## Versioning

Routes are mounted under `/api/v1`, with the version decided in one place
(`API_VERSION` in `app.ts`). Publishing `/api/v2` is a change to that constant
plus a new mount, not an edit across ten route files.

Clients still calling the pre-versioning `/api/...` paths are served by a
compatibility shim that logs the use, sets `Deprecation: true`, and returns a
`Link: </api/v1>; rel="successor-version"` header. It is a migration aid, not a
permanent alias — drop it once nothing is on it.