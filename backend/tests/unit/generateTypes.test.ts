import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { API_ROUTES } from "../../src/routes";
import { buildOpenApiDocument } from "../../src/openapi/generate";
import { renderTypesFile } from "../../src/openapi/generateTypes";

/**
 * The generated frontend types are only trustworthy if regenerating them is
 * deterministic and actually run.
 *
 * Two failure modes this guards:
 *   1. Someone edits the generated file by hand, and the next regeneration
 *      silently discards the edit.
 *   2. The generator's output changes (a schema, a route) and nobody regenerates,
 *      so the frontend keeps describing the old API.
 *
 * Both are invisible in normal use — the types compile either way — so they are
 * checked here instead.
 */

const GENERATED_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../frontend/src/types/api.generated.ts",
);

const document = buildOpenApiDocument({ mounts: API_ROUTES }) as Record<string, any>;

describe("generated frontend types", () => {
  it("the file exists", () => {
    expect(fs.existsSync(GENERATED_PATH), `${GENERATED_PATH} is missing`).toBe(true);
  });

  it("is up to date with the API", () => {
    const expected = renderTypesFile(document);
    const actual = fs.readFileSync(GENERATED_PATH, "utf8");

    if (actual !== expected) {
      // Say what to do rather than just failing: a stale generated file is a
      // five-second fix for whoever hit it.
      throw new Error(
        "frontend/src/types/api.generated.ts is out of date with the API.\n" +
          "Run:  cd backend && npm run generate:types\n",
      );
    }
  });

  it("is deterministic — regenerating produces identical output", () => {
    expect(renderTypesFile(document)).toBe(renderTypesFile(document));
  });

  it("says it is generated and how to regenerate it", () => {
    const contents = fs.readFileSync(GENERATED_PATH, "utf8");
    expect(contents).toContain("GENERATED FILE");
    expect(contents).toContain("npm run generate:types");
  });
});

describe("type generator", () => {
  const emitted = renderTypesFile(document);

  it("produces a file that declares no duplicate type names", () => {
    const names = [...emitted.matchAll(/^export type (\w+)/gm)].map((m) => m[1]);
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    expect(duplicates, `duplicate declarations: ${duplicates.join(", ")}`).toEqual([]);
  });

  it("derives every alias from a real operation", () => {
    const operationIds = Object.entries<Record<string, any>>(document.paths).flatMap(
      ([, methods]) => Object.values(methods).map((op: any) => op.operationId),
    );
    expect(operationIds.length).toBeGreaterThan(70);
    for (const operationId of operationIds) {
      // operationId is snake_case; the alias is its PascalCase form.
      const alias =
        operationId.replace(/(^|_)(\w)/g, (_, __, c: string) => c.toUpperCase()) + "";
      expect(emitted, `no type for ${operationId}`).toContain(`export type ${alias} `);
    }
  });

  it("types a typed record rather than discarding its value type", () => {
    // zod's `z.record(z.number())` must survive as `Record<string, number>`.
    // Collapsing it to `Record<string, unknown>` broke the review histogram at
    // compile time, which is how the gap was noticed.
    expect(emitted).toContain("Record<string, number>");
    expect(emitted).not.toContain("Record<string, unknown>;\n  }");
  });

  it("describes the report file's mutually exclusive storage fields", () => {
    // The reason ReportFile cannot be guessed at: images live in Cloudinary
    // (url/publicId) and PDFs in GridFS (storageId), so every storage field is
    // optional and none of them is required.
    // PostReport is an alias, so read the definition it points at.
    const block = emitted.slice(
      emitted.indexOf("export type PostReportData = "),
      emitted.indexOf("export type PostReviewData = "),
    );
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(/url\?: string/);
    expect(block).toMatch(/publicId\?: string/);
    expect(block).toMatch(/storageId\?: string/);
    expect(block).toMatch(/storage\?: "cloudinary" \| "gridfs"/);
  });

  it("encodes the notification fields the server actually sends", () => {
    // recipientId / body / readAt — a guessed schema used userId / message /
    // read and matched nothing the server has ever returned.
    const block = emitted.slice(emitted.indexOf("export type GetNotification = "));
    expect(block).toMatch(/recipientId: string/);
    expect(block).toMatch(/body: string/);
    expect(block).toMatch(/readAt: string \| null/);
    expect(block).not.toMatch(/\buserId:/);
    expect(block).not.toMatch(/\bread: boolean/);
  });

  it("does not leak a role into the patient directory", () => {
    // getPatients projects without `role`; typing it as present would make
    // every consumer read a field that never arrives.
    const block = emitted.slice(
      emitted.indexOf("export type GetUserPatientsData = "),
      emitted.indexOf("export type PostReviewData = "),
    );
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/\brole: "patient"/);
  });
});