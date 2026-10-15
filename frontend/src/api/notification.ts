import API from "./axios";
import type { GetNotification, GetNotificationUnreadCountData } from "@/types/api.generated";

/**
 * Derived from the server's response schema rather than declared here.
 *
 * This is the clearest case of why. A hand-written version of this file once
 * described notifications with `userId`, `message` and `read`, which looked
 * entirely reasonable and matched nothing the server had ever sent. The real
 * fields are `recipientId`, `body` and `readAt` (null until read), and the type
 * enum has four values, not the nine a plausible guess produces.
 *
 * Nothing caught it because a hand-written interface is never checked against
 * the server that has to satisfy it. These are.
 */
export type Notification = GetNotification[number];
export type NotificationType = Notification["type"];
export type UnreadCount = GetNotificationUnreadCountData;

export const getNotifications = async (limit = 30) => {
  return await API.get("/notification", { params: { limit } });
};

export const getUnreadCount = async () => {
  return await API.get("/notification/unread-count");
};

export const markNotificationRead = async (id: string) => {
  return await API.patch(`/notification/${id}/read`);
};

export const markAllNotificationsRead = async () => {
  return await API.patch("/notification/read-all");
};