import { formatInTimeZone } from "date-fns-tz";
import { CLINIC_TIMEZONE } from "../constants/clinic";

/**
 * UTC-midnight anchor of "today" in the clinic's timezone.
 * Appointment dates are stored as UTC midnight, so comparisons
 * must use the same shape.
 */
export const getClinicTodayAnchor = (): Date => {
  const [year, month, day] = formatInTimeZone(new Date(), CLINIC_TIMEZONE, "yyyy-MM-dd")
    .split("-")
    .map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

/** True when a UTC-midnight appointment date is "today" in the clinic timezone. */
export const isClinicToday = (date: Date): boolean =>
  getClinicTodayAnchor().getTime() === date.getTime();

/** Minutes since midnight right now, in the clinic timezone. */
export const getClinicNowMinutes = (): number => {
  const [hours, minutes] = formatInTimeZone(new Date(), CLINIC_TIMEZONE, "HH:mm")
    .split(":")
    .map(Number);
  return hours * 60 + minutes;
};

/** Parse a "YYYY-MM-DD" string into its UTC-midnight anchor. */
export const parseDateAnchor = (dateStr: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject impossible dates like 2026-02-31 (Date rolls them over)
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date;
};
