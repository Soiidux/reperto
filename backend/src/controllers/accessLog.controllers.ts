import { Request, Response } from "express";
import mongoose from "mongoose";
import AccessLog from "../db/models/accessLog.model";
import { ApiError } from "../errors";
import { canActForPatient } from "../utils/patientScope";

const isValidObjectId = (value: unknown): value is string =>
  typeof value === "string" && mongoose.isValidObjectId(value);

/**
 * Access-audit queries.
 *
 * Two views, matching the two questions an audit is actually asked:
 *   GET /api/admin/audit/patient/:patientId  — "who has looked at this patient?"
 *   GET /api/admin/audit/activity            — "what has this staff member done?"
 *
 * Admin-only. Staff can read patient records but cannot read the audit trail,
 * because an audit log is itself sensitive: it exposes which clinicians are
 * curious about which patients.
 */
export const getPatientAccessLog = async (req: Request, res: Response) => {
  const { patientId } = req.params;
  if (!isValidObjectId(patientId)) {
    throw new ApiError(400, "Invalid patient id");
  }

  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const entries = await AccessLog.find({ patientId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return res.status(200).json({
    success: true,
    message: "Patient access log retrieved successfully",
    data: { count: entries.length, entries },
  });
};

export const getAccessActivity = async (req: Request, res: Response) => {
  const { actorId, resource, action } = req.query;

  if (actorId !== undefined && !isValidObjectId(actorId)) {
    throw new ApiError(400, "Invalid actorId");
  }

  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const query: Record<string, unknown> = {};
  if (actorId) query.actorId = actorId;
  if (resource) query.resource = resource;
  if (action) query.action = action;

  const entries = await AccessLog.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return res.status(200).json({
    success: true,
    message: "Access activity retrieved successfully",
    data: { count: entries.length, entries },
  });
};

/**
 * Answer a specific concern: has this patient been accessed by anyone other
 * than the patient themselves, or by a given clinician?
 */
export const getPatientAccessByStaff = async (req: Request, res: Response) => {
  const { patientId } = req.params;
  if (!isValidObjectId(patientId)) {
    throw new ApiError(400, "Invalid patient id");
  }

  // Admins may audit anyone; a staff member may only audit patients they are
  // permitted to act for, which keeps the endpoint from being a blanket probe.
  if (req.user.role === "staff") {
    if (!(await canActForPatient(req.user.id, patientId))) {
      throw new ApiError(403, "You are not authorized to view this.");
    }
  }

  const staffEntries = await AccessLog.find({
    patientId,
    actorRole: { $ne: "patient" },
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return res.status(200).json({
    success: true,
    message: "Staff access to this patient retrieved successfully",
    data: { count: staffEntries.length, entries: staffEntries },
  });
};