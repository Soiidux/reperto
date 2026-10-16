import mongoose, { Schema, Document, Types } from "mongoose";
import logger from "../../utils/logger";
import { toId } from "../../utils/ids";

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
 *
 * But "never throws" must not stretch to "never tells you". An audit row dropped
 * in silence is worse than one loudly missing, because the silence looks exactly
 * like a complete trail. That happened here once: the check-in caller passed a
 * *populated* patient, whose String() is "[object Object]", so every check-in
 * row vanished without a single symptom.
 *
 * So an unusable id is counted and logged rather than discarded quietly.
 */
export const recordAccess = async (input: AccessLogInput): Promise<void> => {
  try {
    // toId, not String: it accepts a populated document, a raw ObjectId or a
    // string, so adding a .populate() to the caller's query later cannot silently
    // turn this audit into a no-op.
    const actorRaw = toId(input.actorId);
    const patientRaw = toId(input.patientId);
    const actorId = actorRaw && mongoose.isValidObjectId(actorRaw)
      ? new mongoose.Types.ObjectId(actorRaw)
      : null;
    const patientId = patientRaw && mongoose.isValidObjectId(patientRaw)
      ? new mongoose.Types.ObjectId(patientRaw)
      : null;

    // Without both parties the entry would be meaningless, so skip rather than
    // write a half-empty row — but say that it was skipped.
    if (!actorId || !patientId) {
      recordAccess.dropped += 1;
      logger.warn("Audit entry dropped: unusable id", {
        resource: input.resource,
        action: input.action,
        route: input.route,
        hasActor: Boolean(actorId),
        hasPatient: Boolean(patientId),
      });
      return;
    }

    const resourceRaw = toId(input.resourceId);
    await AccessLog.create({
      actorId,
      actorRole: input.actorRole ?? "unknown",
      actorName: input.actorName,
      patientId,
      resource: input.resource,
      resourceId:
        resourceRaw && mongoose.isValidObjectId(resourceRaw)
          ? new mongoose.Types.ObjectId(resourceRaw)
          : undefined,
      action: input.action,
      route: input.route,
      ip: input.ip,
    });
  } catch {
    // Still silent for *storage* failures: auditing must not break the request.
    // Counted, so a systematically failing audit is visible rather than assumed.
    recordAccess.dropped += 1;
  }
};

/**
 * How many audit entries were dropped. Exposed so a test can assert the count
 * does not creep up — the failure this file guards against is invisible from
 * the database alone, since nothing is written when it happens.
 */
recordAccess.dropped = 0;

export default AccessLog;