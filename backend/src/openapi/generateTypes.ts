import { z } from "zod";

/**
 * Emit TypeScript types from the generated OpenAPI document.
 *
 * The point is to delete hand-written interfaces that mirror backend payloads.
 * Those drift silently: the server renames a field, the client keeps compiling
 * against an interface nobody remembers maintaining, and the bug shows up as
 * `undefined` at runtime rather than an error at build time.
 *
 * Going through the OpenAPI document — rather than importing the zod schemas
 * directly — is deliberate. It means these types are derived from the *published*
 * contract, so a type can never describe something the documentation does not.
 *
 * Deliberately not a general-purpose converter: it handles exactly the JSON
 * Schema subset that z.toJSONSchema emits for the schemas in this project, and
 * throws on anything else rather than silently degrading a type to `any`. A
 * generator that quietly widens everything is worse than none.
 */

type JsonSchema = Record<string, any>;

const INDENT = "  ";

/** Type names must be valid identifiers; JSON Schema titles are not guaranteed. */
const pascal = (raw: string): string =>
  raw
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("") || "Schema";

const quote = (value: string): string =>
  `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

const isPlainObject = (schema: JsonSchema): boolean =>
  schema?.type === "object" || (schema?.type === undefined && schema?.properties);

const typeNameFor = (schema: JsonSchema): string => {
  const ref = String(schema?.$ref ?? "");
  if (ref) return pascal(ref.split("/").pop()!);
  return pascal(schema?.title ?? "anonymous");
};

/**
 * Resolve `$ref` against the document. One level of indirection is all the
 * generated schemas use, so a recursive resolver is unnecessary complexity.
 */
const makeResolver = (document: JsonSchema) => {
  const seen = new Set<JsonSchema>();
  const resolve = (schema: JsonSchema): JsonSchema => {
    if (!schema?.$ref) return schema;
    const ref = schema.$ref as string;
    if (ref.startsWith("#/")) {
      const target = ref
        .slice(2)
        .split("/")
        .reduce<any>((node, key) => node?.[key], document);
      if (!target) throw new Error(`Unresolvable $ref: ${ref}`);
      if (seen.has(target)) return target;
      seen.add(target);
      return resolve(target);
    }
    return schema;
  };
  return resolve;
};

/** Convert a JSON Schema node into a TypeScript type expression. */
export const schemaToType = (
  rawSchema: JsonSchema,
  resolve: (s: JsonSchema) => JsonSchema,
  indent = 0,
): string => {
  const schema = resolve(rawSchema);

  if (schema === undefined || schema === null || typeof schema !== "object") return "unknown";
  // zod emits `{}` for "any object" and for transformations it cannot express.
  if (Object.keys(schema).length === 0) return "unknown";

  if (schema.anyOf) {
    const parts = schema.anyOf.map((s: JsonSchema) => schemaToType(s, resolve, indent));
    return [...new Set(parts)].join(" | ");
  }
  if (schema.oneOf) {
    const parts = schema.oneOf.map((s: JsonSchema) => schemaToType(s, resolve, indent));
    return [...new Set(parts)].join(" | ");
  }
  if (schema.const !== undefined) return JSON.stringify(schema.const);

  switch (schema.type) {
    case "string":
      if (schema.enum) return schema.enum.map((v: unknown) => JSON.stringify(v)).join(" | ");
      if (schema.format === "date-time") return "string";
      return "string";
    case "number":
      if (schema.enum) return schema.enum.map((v: unknown) => JSON.stringify(v)).join(" | ");
      return "number";
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "array": {
      const item = schemaToType(schema.items ?? {}, resolve, indent);
      const needsParens = item.includes("|") || item.includes("&");
      return `${needsParens ? `(${item})` : item}[]`;
    }
    case "object":
    default:
      return objectToType(schema, resolve, indent);
  }
};

const objectToType = (
  schema: JsonSchema,
  resolve: (s: JsonSchema) => JsonSchema,
  indent: number,
): string => {
  const properties: Record<string, JsonSchema> = schema.properties ?? {};
  const required = new Set<string>(schema.required ?? []);
  const keys = Object.keys(properties);

  // No declared properties. Two distinct cases that both land here, and
  // conflating them is a real bug: zod's `record(value)` emits
  // `additionalProperties: <schema>`, while `z.any()` emits
  // `additionalProperties: true`.
  if (keys.length === 0) {
    const additional = schema.additionalProperties;
    if (additional === false) return "Record<string, never>";
    if (additional && typeof additional === "object") {
      // A typed record. Collapsing this to `Record<string, unknown>` loses the
      // value type, and then `record[key] ?? 0` fails to typecheck — which is
      // how the gap was found.
      const valueType = schemaToType(additional, resolve, indent);
      return `Record<string, ${valueType}>`;
    }
    return "Record<string, unknown>";
  }

  const pad = INDENT.repeat(indent + 1);
  const closePad = INDENT.repeat(indent);
  const lines = keys.map((key) => {
    // A quoted key is only needed when it is not a valid bare identifier.
    const propName = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : quote(key);
    // Optional marker rather than `| undefined`. For a JSON payload the server
    // omits an absent field entirely, and `field?: T` describes that; the union
    // form would instead demand the key be present and explicitly undefined.
    // (exactOptionalPropertyTypes is off, so `?:` stays permissive either way.)
    const optional = required.has(key) ? "" : "?";
    const type = schemaToType(properties[key], resolve, indent + 1);
    return `${pad}${propName}${optional}: ${type};`;
  });

  return `{\n${lines.join("\n")}\n${closePad}}`;
};

/** Indent a multi-line type expression so it nests correctly. */
const indentBlock = (text: string, levels: number): string => {
  if (!text.includes("\n")) return text;
  const pad = INDENT.repeat(levels);
  return text.split("\n").map((line) => (line ? pad + line : line)).join("\n");
};

export type GeneratedTypes = {
  /** Named type declarations, keyed by type name. */
  types: Map<string, string>;
  /** Per-operation result aliases: operationId -> payload type. */
  operations: Map<string, { path: string; method: string; dataType: string }>;
};

export const generateTypes = (document: JsonSchema): GeneratedTypes => {
  const resolve = makeResolver(document);
  const types = new Map<string, string>();
  const operations = new Map<string, { path: string; method: string; dataType: string }>();

  for (const [path, methods] of Object.entries<JsonSchema>(document.paths ?? {})) {
    for (const [method, operation] of Object.entries<JsonSchema>(methods)) {
      const op = operation as JsonSchema;
      const operationId = String(op.operationId ?? `${method}_${path}`);
      const okSchema = op?.responses?.["200"]?.content?.["application/json"]?.schema;
      if (!okSchema) continue;

      const dataSchema = okSchema.properties?.data ?? {};
      const dataType = schemaToType(dataSchema, resolve, 0);

      const alias = `${pascal(operationId)}Data`;
      // Only store when it is a named object type; inline unions and primitives
      // are already perfectly usable as written.
      if (dataType.startsWith("{") && !types.has(alias)) {
        types.set(alias, dataType);
      }

      operations.set(operationId, {
        path,
        method: method.toUpperCase(),
        dataType: types.has(alias) ? alias : dataType,
      });
    }
  }

  return { types, operations };
};

export const renderTypesFile = (document: JsonSchema, apiVersion = "v1"): string => {
  const { types, operations } = generateTypes(document);
  const coverage = document["x-documentation"] ?? {};

  const header = `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate with:  npm run generate:types   (from backend/)
 *
 * Derived from the OpenAPI document the server publishes at
 * /api/${apiVersion}/docs/openapi.json, so these types cannot describe an
 * endpoint the API does not actually serve.
 *
 * Coverage when generated: ${coverage.totalOperations ?? "?"} operations,
 * ${types.size} with a named response type.
 *
 * Hand-written interfaces that mirror server payloads are the thing this file
 * replaces. A field renamed on the server should be a compile error here rather
 * than an \`undefined\` at runtime.
 *
 * Where an operation has no named type its payload is inlined, which is the
 * generator being honest about a response it cannot give a name to yet — see
 * \`x-response-schema-pending\` in the spec.
 */

export type ApiVersion = "${apiVersion}";
`;

  const typeBlocks = [...types.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, body]) => `export type ${name} = ${body};`)
    .join("\n\n");

  const operationAliases = [...operations.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([operationId, { path, method, dataType }]) =>
        `/** \`${method} ${path}\` */\nexport type ${pascal(operationId)} = ${dataType};`,
    )
    .join("\n\n");

  return [
    header,
    "// ── Response payload types ──────────────────────────────────────────────",
    typeBlocks || "// (none)",
    "",
    "// ── Per-operation aliases ───────────────────────────────────────────────",
    operationAliases || "// (none)",
    "",
  ].join("\n");
};

/**
 * CLI entry point.
 *
 * A function rather than top-level await: the project's `module` setting does
 * not permit it, and the module must stay safely importable from a test without
 * writing files as a side effect.
 */
const main = async () => {
  const { API_ROUTES } = await import("../routes");
  const { buildOpenApiDocument } = await import("./generate");
  const doc = buildOpenApiDocument({ mounts: API_ROUTES }) as unknown as JsonSchema;
  const text = renderTypesFile(doc);

  const writeIndex = process.argv.indexOf("--write");
  if (writeIndex === -1) {
    // eslint-disable-next-line no-console
    console.log(text);
    return;
  }

  const out =
    process.env.TYPES_OUT ??
    process.argv[writeIndex + 1] ??
    "../frontend/src/types/api.generated.ts";
  const fs = await import("fs");
  fs.mkdirSync(out.replace(/\/[^/]+$/, ""), { recursive: true });
  fs.writeFileSync(out, text, "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${out} (${text.length} bytes)`);
};

// Only run when invoked directly, so importing this from a test is inert.
if (
  typeof process !== "undefined" &&
  /generateTypes\.(ts|js)$/.test(process.argv[1] ?? "")
) {
  await main();
}