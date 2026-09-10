import { Response } from "express";
import Notification from "../db/models/notification.model";

const MAX_LIMIT = 50;

export const getNotifications = async (req: any, res: Response) => {
  const limit = Math.min(Number(req.query.limit) || 30, MAX_LIMIT);
  const notifications = await Notification.find({ recipientId: req.user.id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("-updatedAt");

  res.status(200).json({ success: true, data: notifications });
};

export const getUnreadCount = async (req: any, res: Response) => {
  const unread = await Notification.countDocuments({
    recipientId: req.user.id,
    readAt: null,
  });

  res.status(200).json({ success: true, data: { unread } });
};

export const markNotificationRead = async (req: any, res: Response) => {
  const { id } = req.params;

  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipientId: req.user.id },
    { $set: { readAt: new Date() } },
    { new: true },
  );

  if (!notification) {
    return res.status(404).json({ success: false, message: "Notification not found", data: null });
  }

  res.status(200).json({ success: true, data: notification });
};

export const markAllNotificationsRead = async (req: any, res: Response) => {
  await Notification.updateMany(
    { recipientId: req.user.id, readAt: null },
    { $set: { readAt: new Date() } },
  );

  res.status(200).json({ success: true, message: "All notifications marked as read", data: null });
};