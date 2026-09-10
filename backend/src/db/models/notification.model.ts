import mongoose, { Schema, Document } from "mongoose";

export const NOTIFICATION_TYPES = [
  "leave-conflict",
  "appointment-status",
  "appointment-rescheduled",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document {
  recipientId: mongoose.Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  appointmentId?: mongoose.Types.ObjectId;
  readAt?: Date | null;
  createdAt: Date;
}

const NotificationSchema: Schema = new Schema(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String, required: false },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Fast unread-scoped lists and badge counts per recipient.
NotificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });

export default mongoose.model<INotification>("Notification", NotificationSchema);