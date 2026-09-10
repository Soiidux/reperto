import API from "./axios";

export type NotificationType =
  | "leave-conflict"
  | "appointment-status"
  | "appointment-rescheduled";

export interface Notification {
  _id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  appointmentId?: string;
  readAt: string | null;
  createdAt: string;
}

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