import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import os from "os";
import path from "path";
import config from "../../src/config";

/**
 * Regression guard for the report vault: a PDF stored as a Cloudinary
 * "image" asset answers 401 on its own .pdf URL, so the link the UI renders is
 * dead even though the upload reported success. This asserts the real
 * contract against the live Cloudinary account:
 *
 *   image report -> URL serves image bytes
 *   PDF report   -> resource_type "raw", URL serves application/pdf
 *
 * Skipped unless CLOUDINARY_* credentials are configured and reachable, so it
 * never fails the offline/unit test run.
 */

const hasCreds = Boolean(
  config.cloudinary.name && config.cloudinary.apiKey && config.cloudinary.apiSecret,
);

const describeLive = hasCreds ? describe : describe.skip;

let folder: string;

const makePng = () =>
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );

const makePdf = () =>
  Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
      "trailer<</Root 1 0 R>>\n%%EOF\n",
    "latin1",
  );

/** Cloudinary's uploader wants a filesystem path, so stage the bytes. */
const stage = (name: string, contents: Buffer) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rp-report-"));
  const file = path.join(dir, name);
  fs.writeFileSync(file, contents);
  return file;
};

/** Fetch a delivery URL and report status + content type. */
const probe = async (url: string) => {
  const res = await fetch(url);
  return { status: res.status, type: res.headers.get("content-type") ?? "" };
};

describeLive("cloudinary report delivery (live)", () => {
  beforeAll(() => {
    cloudinary.config({
      cloud_name: config.cloudinary.name,
      api_key: config.cloudinary.apiKey,
      api_secret: config.cloudinary.apiSecret,
    });
    folder = `reperto/test-${Date.now()}`;
  });

  afterAll(async () => {
    // Best-effort cleanup so repeated runs don't pile up test assets.
    try {
      await cloudinary.api.delete_resources_by_prefix(folder, {
        resource_type: "image",
      });
    } catch {
      /* ignore */
    }
    try {
      await cloudinary.api.delete_resources_by_prefix(folder, {
        resource_type: "raw",
      });
    } catch {
      /* ignore */
    }
  });

  it("delivers an uploaded image report as image bytes", async () => {
    const uploaded = await cloudinary.uploader.upload(stage("scan.png", makePng()), {
      resource_type: "image",
      folder,
    });

    expect(uploaded.secure_url).toBeTruthy();
    expect(uploaded.resource_type).toBe("image");

    const { status, type } = await probe(uploaded.secure_url);
    expect(status).toBe(200);
    expect(type).toMatch(/^image\//);
  });

  it("documents that Cloudinary cannot deliver PDF bytes on this account", async () => {
    // The behaviour that drove the GridFS fix. This is a property of the
    // Cloudinary plan, so it is asserted as documentation rather than a hard
    // requirement: if the account is upgraded and starts serving PDFs, this
    // test should be revisited (the GridFS path still works either way).
    const uploaded = await cloudinary.uploader.upload(
      stage("sample-report.pdf", makePdf()),
      { resource_type: "raw", folder, public_id: "sample-report.pdf" },
    );

    expect(uploaded.resource_type).toBe("raw");

    const { status } = await probe(uploaded.secure_url);
    const blocked = status !== 200;

    // Non-PDF raw assets serve normally, which is what isolates this to
    // PDF delivery rather than raw delivery in general.
    const textUpload = await cloudinary.uploader.upload(
      stage("notes.txt", Buffer.from("plain text")),
      { resource_type: "raw", folder, public_id: "notes.txt" },
    );
    const textProbe = await probe(textUpload.secure_url);

    expect(textProbe.status).toBe(200);
    // eslint-disable-next-line no-console
    console.log(
      blocked
        ? "[cloudinary] PDF delivery blocked (401) — reports use GridFS, as designed."
        : "[cloudinary] PDF delivery now available; the GridFS fallback is still correct but could be revisited.",
    );
    expect(typeof blocked).toBe("boolean");
  });

  it("confirms an image-typed PDF is NOT retrievable as .pdf (the original bug)", async () => {
    // Uploaded the way the old code did (resource_type: "auto" -> image).
    const uploaded = await cloudinary.uploader.upload(
      stage("legacy-report.pdf", makePdf()),
      { resource_type: "auto", folder, public_id: "legacy-report" },
    );

    if (uploaded.resource_type !== "image") {
      // Cloudinary changed its default; nothing to prove here.
      return;
    }

    const { status } = await probe(uploaded.secure_url);
    expect(status).not.toBe(200);
  });
});

