import { describe, expect, it } from "vitest";
import { pickResourceType } from "../../src/utils/cloudinary";

/**
 * Cloudinary's "auto" detection classifies PDFs as image-type assets, but
 * image delivery only serves image formats — fetching the stored .pdf URL then
 * answers 401 even though the upload succeeded. These tests pin the mapping
 * that keeps documents deliverable.
 */

describe("pickResourceType", () => {
  it("keeps images on the image resource type", () => {
    expect(pickResourceType("/tmp/1.png", "image/png")).toBe("image");
    expect(pickResourceType("/tmp/1.jpg", "image/jpeg")).toBe("image");
    expect(pickResourceType("/tmp/1.webp", "image/webp")).toBe("image");
    expect(pickResourceType("/tmp/1.gif", "image/gif")).toBe("image");
    expect(pickResourceType("/tmp/1.svg", "image/svg+xml")).toBe("image");
  });

  it("routes PDFs to raw so the stored URL actually delivers a PDF", () => {
    // This is the bug: as an image asset the .pdf URL returns 401.
    expect(pickResourceType("/tmp/scan.pdf", "application/pdf")).toBe("raw");
  });

  it("routes other documents to raw", () => {
    expect(pickResourceType("/tmp/notes.txt", "text/plain")).toBe("raw");
    expect(pickResourceType("/tmp/data.json", "application/json")).toBe("raw");
    expect(pickResourceType("/tmp/feed.xml", "application/xml")).toBe("raw");
  });

  it("is case-insensitive on the mime type", () => {
    expect(pickResourceType("/tmp/x.pdf", "APPLICATION/PDF")).toBe("raw");
    expect(pickResourceType("/tmp/x.png", "IMAGE/PNG")).toBe("image");
  });

  it("falls back to the file extension when the browser sends no type", () => {
    expect(pickResourceType("/tmp/uploads/photo.jpeg", undefined)).toBe("image");
    expect(pickResourceType("/tmp/uploads/scan.pdf", "")).toBe("raw");
    expect(pickResourceType("/tmp/uploads/doc.docx", undefined)).toBe("raw");
  });

  it("prefers the mime type over a misleading extension", () => {
    // Some clients send octet-stream but the real content is a PDF.
    expect(pickResourceType("/tmp/scan.pdf", "application/octet-stream")).toBe("raw");
    expect(pickResourceType("/tmp/scan.pdf", "application/pdf")).toBe("raw");
  });

  it("defaults unknown extensions to raw rather than mis-serving them", () => {
    expect(pickResourceType("/tmp/mystery.abc", undefined)).toBe("raw");
    expect(pickResourceType("/tmp/noextension", undefined)).toBe("raw");
  });
});
