import { Request, Response } from "express";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import Report from "../db/models/report.model";
import User from "../db/models/user.model";
import { ApiError } from "../errors";
import { canActForPatient } from "../utils/patientScope";
import { uploadToCloudinary } from "../utils/cloudinary";
import { reportUploadSchema } from "../zodSchemas";

const forbiddenResponse: ApiResponse<null> = {
  success: false,
  message: "You are not authorized to view this.",
  data: null,
};

const isValidObjectId = (value: unknown): value is string =>
  typeof value === "string" && mongoose.isValidObjectId(value);

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
    url: string;
    publicId: string;
    name: string;
    mimeType: string;
    size: number;
    resourceType: string;
  }[] = [];

  try {
    for (const file of files) {
      const result = await uploadToCloudinary(file.path, "reports");
      if (!result?.secure_url || !result?.public_id) {
        throw new ApiError(500, "File upload failed, please try again");
      }
      uploaded.push({
        url: result.secure_url,
        publicId: result.public_id,
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        resourceType: result.resource_type || "image",
      });
    }
  } catch (error) {
    // Don't leave orphaned assets if a later file in the batch fails
    await Promise.allSettled(
      uploaded.map((f) => cloudinary.uploader.destroy(f.publicId)),
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

  return res.status(200).json({
    success: true,
    message: "Reports retrieved successfully",
    data: { count: reports.length, reports },
  });
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
      String(report.patientId),
    );
    if (!authorized) {
      throw new ApiError(403, forbiddenResponse.message);
    }
  }

  await Promise.allSettled(
    report.files.map((f) => cloudinary.uploader.destroy(f.publicId)),
  );
  await Report.deleteOne({ _id: report._id });

  return res.status(200).json({
    success: true,
    message: "Report deleted successfully",
    data: null,
  });
};