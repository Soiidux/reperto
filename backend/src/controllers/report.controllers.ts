import { Request, Response } from "express";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import Report from "../db/models/report.model";
import User from "../db/models/user.model";
import { ApiError } from "../errors";
import { readFile } from "fs/promises";
import { toId } from "../utils/ids";
import { canActForPatient } from "../utils/patientScope";
import { uploadToCloudinary } from "../utils/cloudinary";
import {
  deleteReportFile,
  getReportFileBuffer,
  putReportFile,
} from "../utils/reportStore";
import { reportUploadSchema } from "../zodSchemas";
import { recordAccess } from "../db/models/accessLog.model";

const forbiddenResponse: ApiResponse<null> = {
  success: false,
  message: "You are not authorized to view this.",
  data: null,
};

const isValidObjectId = (value: unknown): value is string =>
  typeof value === "string" && mongoose.isValidObjectId(value);

/**
 * PDF delivery is blocked on this Cloudinary account (the CDN answers 401 for
 * a stored .pdf URL), so PDFs are kept in GridFS and streamed back through an
 * authenticated route. Images keep using Cloudinary, which works normally.
 */
const isPdf = (mimeType: string) =>
  mimeType.toLowerCase() === "application/pdf";

const resolveTargetPatientId = async (
  req: Request,
  requestedPatientId: string | undefined,
): Promise<string> => {
  const role = req.user.role;

  if (role === "patient") {
    if (!requestedPatientId || requestedPatientId === req.user.id) {
      return req.user.id;
    }
    if (!isValidObjectId(requestedPatientId)) {
      throw new ApiError(400, "Invalid patient id");
    }
    if (!(await canActForPatient(req.user.id, requestedPatientId))) {
      throw new ApiError(403, forbiddenResponse.message);
    }
    return requestedPatientId;
  }

  // staff/admin upload on behalf of a patient (front-desk intake)
  if (!requestedPatientId || !isValidObjectId(requestedPatientId)) {
    throw new ApiError(400, "Select a patient for this report");
  }
  const patient = await User.findOne({
    _id: requestedPatientId,
    role: "patient",
    isActive: true,
  });
  if (!patient) {
    throw new ApiError(404, "Patient not found or inactive");
  }
  return String(patient._id);
};

export const uploadReport = async (req: Request, res: Response) => {
  if (req.user.role === "doctor") {
    // Doctors review patient-attached reports but don't manage the vault
    throw new ApiError(403, forbiddenResponse.message);
  }

  const parsed = reportUploadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid request data",
      data: null,
      errors: parsed.error.flatten().fieldErrors,
    });
  }
  const { title, category, description, consultationId } = parsed.data;

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    throw new ApiError(400, "Attach at least one file");
  }
  if (consultationId && !isValidObjectId(consultationId)) {
    throw new ApiError(400, "Invalid consultation id");
  }

  const patientId = await resolveTargetPatientId(req, parsed.data.patientId);

  const uploaded: {
    url?: string;
    publicId?: string;
    storageId?: string;
    storage: "cloudinary" | "gridfs";
    name: string;
    mimeType: string;
    size: number;
    resourceType: string;
  }[] = [];

  try {
    for (const file of files) {
      if (isPdf(file.mimetype)) {
        // GridFS: the CDN cannot serve PDFs on this account, so keep the
        // bytes in MongoDB and serve them from /report/:id/file/:index.
        const stored = await putReportFile(
          await readFile(file.path),
          file.originalname,
          file.mimetype,
        );
        uploaded.push({
          storageId: stored.storageId,
          storage: "gridfs",
          name: file.originalname,
          mimeType: file.mimetype,
          size: stored.bytes,
          resourceType: "raw",
        });
        continue;
      }

      // Pass the mime type so non-image documents aren't mis-stored as
      // image-type assets.
      const result = await uploadToCloudinary(file.path, "reports", file.mimetype);
      if (!result?.secure_url || !result?.public_id) {
        throw new ApiError(500, "File upload failed, please try again");
      }
      uploaded.push({
        url: result.secure_url,
        publicId: result.public_id,
        storage: "cloudinary",
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        resourceType: result.resource_type || "image",
      });
    }
  } catch (error) {
    // Don't leave orphaned assets if a later file in the batch fails.
    await Promise.allSettled(
      uploaded.map(async (f) => {
        if (f.storage === "gridfs" && f.storageId) {
          return deleteReportFile(f.storageId);
        }
        if (f.publicId) {
          return cloudinary.uploader.destroy(f.publicId, {
            resource_type: f.resourceType || "image",
          });
        }
      }),
    );
    throw error;
  }

  const report = new Report({
    patientId,
    uploadedBy: req.user.id,
    title,
    category,
    description: description || "",
    ...(consultationId ? { consultationId } : {}),
    files: uploaded,
  });
  await report.save();

  return res.status(201).json({
    success: true,
    message: "Report uploaded successfully",
    data: report,
  });
};

export const listReports = async (req: Request, res: Response) => {
  const { patientId } = req.query;
  if (!isValidObjectId(patientId)) {
    throw new ApiError(400, "patientId query parameter is required");
  }

  if (req.user.role === "patient") {
    if (!(await canActForPatient(req.user.id, patientId))) {
      throw new ApiError(403, forbiddenResponse.message);
    }
  } else if (!(await User.exists({ _id: patientId }))) {
    throw new ApiError(404, "Patient not found");
  }

  const reports = await Report.find({ patientId })
    .populate("uploadedBy", "name profileImageUrl role")
    .populate("patientId", "name profileImageUrl")
    .sort({ createdAt: -1 });

  // Audit the *read* of a patient's report vault, not just the check-in.
  // Awaited deliberately: recordAccess can never throw, and an audit entry
  // that lands after the response is not much of an audit trail.
  await recordAccess({
    actorId: req.user.id,
    actorRole: req.user.role,
    patientId,
    resource: "report",
    action: "read",
    route: "GET /api/report",
    ip: req.ip,
  });

  return res.status(200).json({
    success: true,
    message: "Reports retrieved successfully",
    data: { count: reports.length, reports },
  });
};

/**
 * Stream a stored report file back to the browser.
 *
 * GridFS files are served from here (Cloudinary can't serve PDFs on this
 * account); Cloudinary-hosted images redirect to their CDN url so the CDN
 * keeps serving them directly.
 */
export const getReportFile = async (req: Request, res: Response) => {
  const { id, index } = req.params;
  if (!isValidObjectId(id)) {
    throw new ApiError(400, "Invalid report id");
  }
  const fileIndex = Number(index);
  if (!Number.isInteger(fileIndex) || fileIndex < 0) {
    throw new ApiError(400, "Invalid file index");
  }

  const report = await Report.findById(id);
  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  // Same access rule as listing reports: patients only their own/family,
  // clinical staff anyone.
  if (req.user.role === "patient") {
    if (!(await canActForPatient(req.user.id, toId(report.patientId)))) {
      throw new ApiError(403, forbiddenResponse.message);
    }
  }

  // Opening the actual document is the most sensitive read in the app, so it
  // is logged separately from listing the vault.
  await recordAccess({
    actorId: req.user.id,
    actorRole: req.user.role,
    patientId: toId(report.patientId),
    resource: "report",
    resourceId: report._id.toString(),
    action: "read",
    route: "GET /api/report/:id/file/:index",
    ip: req.ip,
  });

  const file = report.files[fileIndex];
  if (!file) {
    throw new ApiError(404, "File not found");
  }

  if (file.storage !== "gridfs" || !file.storageId) {
    if (!file.url) {
      throw new ApiError(404, "File not found");
    }
    return res.redirect(302, file.url);
  }

  const bytes = await getReportFileBuffer(file.storageId);
  // Quote the filename so spaces/specials can't break the header.
  const safeName = file.name.replace(/["\\]/g, "_");
  return res
    .status(200)
    .set({
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, max-age=300",
    })
    .send(bytes);
};

export const deleteReport = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    throw new ApiError(400, "Invalid report id");
  }

  const report = await Report.findById(id);
  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  if (
    req.user.role === "doctor"
  ) {
    throw new ApiError(403, forbiddenResponse.message);
  }
  if (req.user.role === "patient") {
    const authorized = await canActForPatient(
      req.user.id,
      toId(report.patientId),
    );
    if (!authorized) {
      throw new ApiError(403, forbiddenResponse.message);
    }
  }

  // Remove the bytes from whichever store holds them, so deleting a report
  // doesn't orphan GridFS files or Cloudinary assets.
  await Promise.allSettled(
    report.files.map(async (f) => {
      if (f.storage === "gridfs" && f.storageId) {
        return deleteReportFile(f.storageId);
      }
      if (f.publicId) {
        return cloudinary.uploader.destroy(f.publicId, {
          resource_type: f.resourceType || "image",
        });
      }
    }),
  );
  await Report.deleteOne({ _id: report._id });

  return res.status(200).json({
    success: true,
    message: "Report deleted successfully",
    data: null,
  });
};