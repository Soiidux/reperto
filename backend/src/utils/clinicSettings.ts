import ClinicSettings from "../db/models/clinicSettings.model";
import { formatInTimeZone } from "date-fns-tz";
import { CLINIC_TIMEZONE } from "../constants/clinic";
import type { ClinicDayHours } from "../db/models/clinicSettings.model";

// Every visit occupies one 15-minute slot. The slot grid is built from the
// clinic's per-day hours at this step, and new appointments must carry this
// duration.
export const SLOT_STEP_MINUTES = 15;

/** "HH:mm" start times for a session from open..close on a 15-minute grid. */
const sessionSlots = (open: string, close: string): string[] => {
  const [oh, om] = open.split(":").map(Number);
  const [ch, cm] = close.split(":").map(Number);
  const start = oh * 60 + om;
  const end = ch * 60 + cm;
  const slots: string[] = [];
  for (let t = start; t < end; t += SLOT_STEP_MINUTES) {
    slots.push(
      `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`,
    );
  }
  return slots;
};

// The clinic's classic day: 9 AM-1 PM and 2-4 PM at 15-minute steps
// (the 1-2 PM lunch pause is simply not part of the grid).
export const DEFAULT_DAY_SLOTS = [
  ...sessionSlots("09:00", "13:00"),
  ...sessionSlots("14:00", "16:00"),
];

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** 0 (Sunday) .. 6 (Saturday) for a clinic-day-anchored date. */
export const getClinicWeekday = (date: Date): number => {
  const dayName = formatInTimeZone(date, CLINIC_TIMEZONE, "EEEE");
  const index = WEEKDAY_NAMES.indexOf(dayName);
  return index === -1 ? 0 : index;
};

const buildDefaultHours = (): ClinicDayHours[] => {
  const hours: ClinicDayHours[] = [];
  for (let day = 0; day <= 6; day += 1) {
    // Sundays are closed by default (admin can reopen it in settings)
    const isOpen = day !== 0;
    hours.push({
      day,
      isOpen,
      slots: isOpen ? [...DEFAULT_DAY_SLOTS] : [],
    });
  }
  return hours;
};

// Sane out-of-the-box settings, minted if the document is missing so the app
// never breaks before the admin has configured anything.
export const buildDefaultSettings = () => ({
  clinicName: "Reperto Homeopathic Clinic",
  address: "",
  phone: "",
  email: "",
  about: "",
  cancellationWindowMinutes: 120,
  hours: buildDefaultHours(),
});

/** The single clinic settings document — created with defaults if absent. */
export const getClinicSettings = async () => {
  const existing = await ClinicSettings.findOne().sort({ createdAt: 1 });
  if (existing) return existing;
  return ClinicSettings.create(buildDefaultSettings());
};

/** The bookable slot start times for a clinic day ([] when closed). */
export const getClinicDaySlots = async (date: Date): Promise<string[]> => {
  const settings = await getClinicSettings();
  const weekday = getClinicWeekday(date);
  const day = settings.hours.find((h) => h.day === weekday);
  if (!day || !day.isOpen) return [];
  return day.slots ?? [];
};

/** Whether a clinic day is shut (closed by hours or blocked all day). */
export const isClinicClosedOn = async (
  date: Date,
  blockouts: { allDay?: boolean; slots?: string[] }[],
): Promise<{ closed: boolean; daySlots: string[] }> => {
  const daySlots = await getClinicDaySlots(date);
  if (blockouts.some((b) => b.allDay)) return { closed: true, daySlots: [] };
  return { closed: daySlots.length === 0, daySlots };
};

/** Resolve a day entry (hours array) or a "no open day" stub. */
export const getDayEntry = (
  settings: { hours: ClinicDayHours[] },
  date: Date,
): ClinicDayHours => {
  const weekday = getClinicWeekday(date);
  return (
    settings.hours.find((h) => h.day === weekday) ?? {
      day: weekday,
      isOpen: false,
      slots: [],
    }
  );
};

/** Human copy for the cancellation window, e.g. 4320 -> "3 days". */
export const formatWindow = (minutes: number): string => {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
};