import mongoose from "mongoose";
import User from "../db/models/user.model";
import Notification, { NotificationType } from "../db/models/notification.model";

type NotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  appointmentId?: mongoose.Types.ObjectId;
};

/**
 * The account that actually sees notices about a patient's appointments:
 * "self" accounts see them directly, dependent records fan out to their
 * first guardian. Mirrors the recipient resolution used for emails in
 * leave.controllers.ts.
 */
export const resolveNotificationRecipient = async (
  patientId: mongoose.Types.ObjectId | string,
): Promise<mongoose.Types.ObjectId | null> => {
  const patient = await User.findById(patientId).select("accountType guardians").lean();
  if (!patient) return null;
  if (patient.accountType === "dependent") {
    const guardianId = patient.guardians?.[0];
    return guardianId ?? null;
  }
  return patient._id;
};

/** Persist an in-app notification. Swallows errors so notifications never break the flow. */
export const createInAppNotification = async (
  recipientId: mongoose.Types.ObjectId | string | null | undefined,
  input: NotificationInput,
) => {
  if (!recipientId) return;
  try {
    await Notification.create({ recipientId, ...input });
  } catch (error) {
    console.error("Failed to save notification:", error);
  }
};

/** Notify whoever is responsible for a patient's appointments (guardian fallback). */
export const notifyPatient = async (
  patientId: mongoose.Types.ObjectId | string,
  input: NotificationInput,
) => {
  const recipientId = await resolveNotificationRecipient(patientId);
  return createInAppNotification(recipientId, input);
};