/** Appointment statuses the front desk can set (mirrors the backend enum). */
export const APPOINTMENT_STATUSES = [
  "pending",
  "arrived",
  "completed",
  "cancelled",
  "no-show",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Human labels for the status dropdown. */
export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "Pending",
  arrived: "Arrived",
  completed: "Completed",
  cancelled: "Cancelled",
  "no-show": "No-show",
};
