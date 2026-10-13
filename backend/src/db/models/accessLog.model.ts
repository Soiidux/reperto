import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Read-access audit trail for protected health information.
 *
 * The clinic already records *check-in* events (who checked a patient in, and
 * when), but nothing recorded who **opened** a patient's records. For a system
 * holding consultations, prescriptions and reports, "who read this patient's
 * data, and when" is a routine audit question — and it is far cheaper to start
 * recording now than to reconstruct later.
 *
 * Writes are fire-and-forget and deliberately never block or fail a request:
 * auditing must not be able to break clinical access.
 */

export const ACCESS_ACTIONS = [
  "read",
  "create",
  "update",
  "delete",
  "export",
] as const;

export type AccessAction = (typeof ACCESS_ACTIONS)[number];

export const ACCESS_RESOURCES = [
  "consultation",
  "report",
  "medical-history",
  "appointment",
  "patient-profile",
] as const;

export type AccessResource = (typeof ACCESS_RESOURCES)[number];

export interface IAccessLog extends Document {
  actorId: Types.ObjectId;
  actorRole: string;
  actorName?: string;
  patientId: Types.ObjectId;
  resource: AccessResource;
  resourceId?: Types.ObjectId;
  action: AccessAction;
  /** e.g. "GET /api/report", for human-readable context. */
  route?: string;
  ip?: string;
  createdAt: Date;
}

const AccessLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorRole: { type: String, required: true },
    actorName: { type: String },
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    resource: { type: String, enum: ACCESS_RESOURCES, required: true },
    resourceId: { type: Schema.Types.ObjectId },
    action: { type: String, enum: ACCESS_ACTIONS, required: true },
    route: { type: String },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The two questions an audit is actually asked: "who looked at patient X?"
// and "what did user Y access on date Z?".
AccessLogSchema.index({ patientId: 1, createdAt: -1 });
AccessLogSchema.index({ actorId: 1, createdAt: -1 });

const AccessLog = mongoose.model<IAccessLog>("AccessLog", AccessLogSchema);

export type AccessLogInput = {
  actorId?: string;
  actorRole?: string;
  actorName?: string;
  patientId?: string;
  resource: AccessResource;
  resourceId?: string;
  action: AccessAction;
  route?: string;
  ip?: string;
};

/**
 * Record an access event. Never throws and never rejects — a failure to audit
 * must not deny a clinician access to records.
 */
export const recordAccess = async (input: AccessLogInput): Promise<void> => {
  try {
    const actorId = input.actorId && mongoose.isValidObjectId(input.actorId)
      ? new mongoose.Types.ObjectId(input.actorId)
      : null;
    const patientId = input.patientId && mongoose.isValidObjectId(input.patientId)
      ? new mongoose.Types.ObjectId(input.patientId)
      : null;

    // Without both parties the entry would be meaningless, so skip rather than
    // write a half-empty row.
    if (!actorId || !patientId) return;

    await AccessLog.create({
      actorId,
      actorRole: input.actorRole ?? "unknown",
      actorName: input.actorName,
      patientId,
      resource: input.resource,
      resourceId:
        input.resourceId && mongoose.isValidObjectId(input.resourceId)
          ? new mongoose.Types.ObjectId(input.resourceId)
          : undefined,
      action: input.action,
      route: input.route,
      ip: input.ip,
    });
  } catch {
    // Intentionally silent: see the note above. Swallowed on purpose.
  }
};

export default AccessLog;