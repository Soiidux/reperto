import mongoose from "mongoose";
import { GridFSBucket } from "mongodb";
import { Readable } from "stream";

/**
 * GridFS-backed blob storage for report files.
 *
 * Cloudinary is used for images, but PDF delivery is blocked on this account's
 * plan: a stored .pdf URL answers 401 from the CDN (even signed, even via
 * fl_attachment), while non-PDF raw assets serve fine. Rather than depend on a
 * Cloudinary plan detail, PDFs are kept in GridFS — the MongoDB deployment the
 * app already uses — and streamed back through an authenticated route.
 *
 * This survives restarts and works across multiple backend instances, unlike
 * local disk.
 */

const BUCKET_NAME = "reportFiles";
let bucket: GridFSBucket | null = null;

const getBucket = (): GridFSBucket => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("MongoDB connection is not ready — cannot access report storage");
  }
  if (!bucket) bucket = new GridFSBucket(db, { bucketName: BUCKET_NAME });
  return bucket;
};

export type StoredBlob = {
  storageId: string;
  bytes: number;
};

/** Persist a file's bytes and return its GridFS id. */
export const putReportFile = async (
  data: Buffer,
  filename: string,
  contentType: string,
): Promise<StoredBlob> => {
  const storageId = new mongoose.Types.ObjectId();

  await new Promise<void>((resolve, reject) => {
    // The id must be passed via the options object: passing it as the
    // filename argument makes the driver mint its own id, so the id we return
    // wouldn't match the stored file.
    const uploadStream = getBucket().openUploadStream(`${filename}`, {
      id: storageId,
      metadata: { filename, contentType, uploadedAt: new Date() },
    });
    uploadStream.on("error", reject);
    uploadStream.on("finish", () => resolve());
    // end:true flushes the final chunk and closes the file document before we
    // resolve; a bare pipe can emit "finish" before GridFS has persisted.
    Readable.from([data]).pipe(uploadStream, { end: true });
  });

  return { storageId: storageId.toString(), bytes: data.length };
};

/** Read a stored file into memory. Reports are small (<=10MB by multer). */
export const getReportFileBuffer = async (storageId: string): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const readStream = getBucket().openDownloadStream(
      new mongoose.Types.ObjectId(storageId),
    );
    readStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    readStream.on("error", reject);
    readStream.on("end", () => resolve());
  });
  return Buffer.concat(chunks);
};

/** Remove a stored file; safe to call when it is already gone. */
export const deleteReportFile = async (storageId: string): Promise<void> => {
  try {
    await getBucket().delete(new mongoose.Types.ObjectId(storageId));
  } catch (error: unknown) {
    const code = (error as { code?: number })?.code;
    // 26 = FileNotFound in the GridFS spec: nothing to do.
    if (code !== 26) throw error;
  }
};
