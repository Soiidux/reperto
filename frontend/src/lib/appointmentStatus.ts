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

/**
 * Badge classes per status, in one place.
 *
 * These used to be redefined in AppointmentCard, PastAppointments and
 * DoctorAgenda, and the labels had drifted apart — the same status rendered as
 * "No Show", "no-show" and "No-show" depending on the page.
 */
export const STATUS_BADGE_CLASS: Record<AppointmentStatus, string> = {
  pending:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50",
  arrived:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50",
  completed:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50",
  cancelled:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/50",
  "no-show":
    "bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-700",
};
