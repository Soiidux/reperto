import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import bcrypt from "bcrypt";
import app from "../../src/app";
import User from "../../src/db/models/user.model";
import Report from "../../src/db/models/report.model";
import config from "../../src/config";

/**
 * Regression tests for report file delivery.
 *
 * PDFs cannot be served from Cloudinary on this account — the CDN answers 401
 * for a stored .pdf URL — so they are stored in GridFS and streamed back via
 * GET /api/report/:id/file/:index. Images keep their direct CDN url.
 *
 * Skipped unless CLOUDINARY_* credentials are configured, since image uploads
 * would otherwise need the live account.
 */

const hasCloudinary = Boolean(
  config.cloudinary.name && config.cloudinary.apiKey && config.cloudinary.apiSecret,
);

// vitest.config.ts already points MONGODB_URI at a dedicated test database,
// so this suite reuses it rather than deriving its own.
const TEST_URI = process.env.MONGODB_URI as string;

const TEST_USERS = {
  staff: { email: "test.reports.staff@reperto.example", password: "Test@12345" },
  patient: { email: "test.reports.patient@reperto.example", password: "Test@12345" },
  otherPatient: { email: "test.reports.other@reperto.example", password: "Test@12345" },
} as const;

const tokens: Record<string, string> = {};
const userIds: Record<string, string> = {};

// A minimal but structurally valid PDF.
const PDF_BYTES = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF\n",
  "latin1",
);

// 1x1 transparent PNG.
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const describeLive = hasCloudinary ? describe : describe.skip;

describeLive("report file delivery", () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_URI);

    for (const role of Object.keys(TEST_USERS) as (keyof typeof TEST_USERS)[]) {
      const { email, password } = TEST_USERS[role];
      const hashed = await bcrypt.hash(password, 10);
      const user = await User.findOneAndUpdate(
        { email },
        {
          $setOnInsert: {
            name: `Test ${role}`,
            email,
            password: hashed,
            phone: "9999999999",
            gender: "other",
            dateOfBirth: new Date("1990-01-01"),
            bloodGroup: "O+",
            role: role === "patient" || role === "otherPatient" ? "patient" : role,
            accountType: "self",
            isActive: true,
            emailVerified: true,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      );
      userIds[role] = user!._id.toString();

      const login = await request(app).post("/api/auth/login").send({
        email,
        password,
      });
      tokens[role] = login.body.data.accessToken as string;
    }
  });

  afterAll(async () => {
    // Clear GridFS artifacts this suite created, then hand the shared test
    // database back for the other suites (each drops it in its own afterAll).
    const db = mongoose.connection.db!;
    await db.collection("reportFiles.files").deleteMany({});
    await db.collection("reportFiles.chunks").deleteMany({});
    await Report.deleteMany({});
    await User.deleteMany({ email: { $in: Object.values(TEST_USERS).map((u) => u.email) } });
    await mongoose.disconnect();
  });

  const upload = (token: string, body: Record<string, string>, files: { name: string; buffer: Buffer; type: string }[]) => {
    const req = request(app)
      .post("/api/report")
      .set("Authorization", `Bearer ${token}`)
      .field("title", body.title)
      .field("category", body.category);

    if (body.consultationId) req.field("consultationId", body.consultationId);
    if (body.patientId) req.field("patientId", body.patientId);

    for (const file of files) req.attach("files", Buffer.from(file.buffer), file.name);
    // Content-Type must be set per part for multer's fileFilter to accept it.
    return req;
  };

  it("stores a PDF in GridFS and serves it back with a pdf content type", async () => {
    const res = await upload(tokens.patient, { title: "Lab PDF", category: "lab" }, [
      { name: "lab-result.pdf", buffer: PDF_BYTES, type: "application/pdf" },
    ]);

    expect(res.status).toBe(201);
    const file = res.body.data.files[0];
    expect(file.storage).toBe("gridfs");
    expect(file.storageId).toBeTruthy();
    // No CDN url: Cloudinary can't serve these.
    expect(file.url).toBeFalsy();

    const download = await request(app)
      .get(`/api/report/${res.body.data._id}/file/0`)
      .set("Authorization", `Bearer ${tokens.patient}`);

    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.headers["content-disposition"]).toContain("lab-result.pdf");
    // The real bytes come back, starting with the PDF magic number.
    expect(download.body.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("keeps image reports on Cloudinary with a direct url", async () => {
    const res = await upload(tokens.patient, { title: "Scan PNG", category: "imaging" }, [
      { name: "scan.png", buffer: PNG_BYTES, type: "image/png" },
    ]);

    expect(res.status).toBe(201);
    const file = res.body.data.files[0];
    expect(file.storage).toBe("cloudinary");
    expect(file.url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(file.publicId).toBeTruthy();
    expect(file.storageId).toBeFalsy();
  });

  it("redirects image downloads to the CDN", async () => {
    const uploadRes = await upload(tokens.patient, { title: "Redirect", category: "other" }, [
      { name: "scan2.png", buffer: PNG_BYTES, type: "image/png" },
    ]);
    expect(uploadRes.status).toBe(201);

    const res = await request(app)
      .get(`/api/report/${uploadRes.body.data._id}/file/0`)
      .set("Authorization", `Bearer ${tokens.patient}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^https:\/\/res\.cloudinary\.com\//);
  });

  it("handles a mixed PDF + image batch", async () => {
    const res = await upload(tokens.staff, {
      title: "Mixed batch",
      category: "other",
      patientId: userIds.patient,
    }, [
      { name: "mixed.pdf", buffer: PDF_BYTES, type: "application/pdf" },
      { name: "mixed.png", buffer: PNG_BYTES, type: "image/png" },
    ]);

    expect(res.status).toBe(201);
    const files = res.body.data.files;
    expect(files).toHaveLength(2);
    expect(files[0].storage).toBe("gridfs");
    expect(files[1].storage).toBe("cloudinary");
  });

  it("blocks a patient from downloading another patient's report", async () => {
    const res = await upload(tokens.patient, { title: "Private", category: "lab" }, [
      { name: "private.pdf", buffer: PDF_BYTES, type: "application/pdf" },
    ]);
    expect(res.status).toBe(201);

    const attempt = await request(app)
      .get(`/api/report/${res.body.data._id}/file/0`)
      .set("Authorization", `Bearer ${tokens.otherPatient}`);

    expect(attempt.status).toBe(403);
  });

  it("requires authentication", async () => {
    const res = await upload(tokens.patient, { title: "Anon", category: "lab" }, [
      { name: "anon.pdf", buffer: PDF_BYTES, type: "application/pdf" },
    ]);
    const id = res.body.data._id;

    const attempt = await request(app).get(`/api/report/${id}/file/0`);
    expect(attempt.status).toBe(401);
  });

  it("404s an out-of-range file index", async () => {
    const res = await upload(tokens.patient, { title: "Index", category: "lab" }, [
      { name: "one.pdf", buffer: PDF_BYTES, type: "application/pdf" },
    ]);

    const missing = await request(app)
      .get(`/api/report/${res.body.data._id}/file/7`)
      .set("Authorization", `Bearer ${tokens.patient}`);
    expect(missing.status).toBe(404);

    const bogus = await request(app)
      .get(`/api/report/${res.body.data._id}/file/notanumber`)
      .set("Authorization", `Bearer ${tokens.patient}`);
    expect(bogus.status).toBe(400);
  });

  it("removes GridFS bytes when the report is deleted", async () => {
    const res = await upload(tokens.patient, { title: "Delete me", category: "lab" }, [
      { name: "delete-me.pdf", buffer: PDF_BYTES, type: "application/pdf" },
    ]);
    const storageId = res.body.data.files[0].storageId;

    const before = await mongoose.connection.db!
      .collection("reportFiles.files")
      .countDocuments({ _id: new mongoose.Types.ObjectId(storageId) });
    expect(before).toBe(1);

    const del = await request(app)
      .delete(`/api/report/${res.body.data._id}`)
      .set("Authorization", `Bearer ${tokens.patient}`);
    expect(del.status).toBe(200);

    const after = await mongoose.connection.db!
      .collection("reportFiles.files")
      .countDocuments({ _id: new mongoose.Types.ObjectId(storageId) });
    expect(after).toBe(0);
  });

  it("still rejects disallowed file types", async () => {
    const res = await upload(tokens.patient, { title: "Bad", category: "other" }, [
      { name: "evil.exe", buffer: Buffer.from("MZ"), type: "application/x-msdownload" },
    ]);
    expect(res.status).toBe(400);
  });
});
