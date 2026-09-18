import { MASTER_SLOTS } from "../constants/slots";
import Leave from "../db/models/leave.model";
import Appointment from "../db/models/appointment.model";
import BookingHold from "../db/models/bookingHold.model";
import { isClinicToday, getClinicNowMinutes } from "../utils/clinicDate";

/**
 * Shared availability math. Booking-time enforcement (assertSlotAvailable),
 * free-slot picker (getAvailableSlots), the league-conflict suggestion
 * generator and the movie-style slot-states endpoint (getSlotStatesFor) all
 * use these helpers, so "available" means the same thing everywhere.
 */

/** "09:15 AM" / "02:30 PM" -> minutes since midnight. */
export const timeToMinutes = (timeStr: string): number => {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

type LeaveBlock = {
  type: string;
  startingDate: Date;
  startingTime?: string;
  endingDate?: Date;
  endingTime?: string;
};

type Booking = {
  timeSlot: string;
  durationInMinutes: number;
};

/** Active reservation docs for one doctor on one clinic day. */
export const getHoldsForDay = async (
  doctorId: string,
  selectedDate: Date,
  excludeHoldId?: string,
) =>
  BookingHold.find({
    doctorId,
    appointmentDate: selectedDate,
    status: "active",
    ...(excludeHoldId ? { _id: { $ne: excludeHoldId } } : {}),
  });

/** Leaves + active bookings + active holds for one doctor on one clinic day. */
export const getDayContext = async (
  doctorId: string,
  selectedDate: Date,
  excludeAppointmentId?: string,
  excludeHoldId?: string,
) => {
  // A leave only "covers" selectedDate when it spans that day (endingDate set
  // and >= selectedDate) or is a single-day leave starting on it. A single-day
  // leave has no endingDate, so without this it would wrongly swallow every
  // future day.
  const blocks = await Leave.find({
    doctorId,
    $or: [
      { startingDate: { $lte: selectedDate }, endingDate: { $gte: selectedDate } },
      { startingDate: selectedDate, endingDate: null },
    ],
  });
  // Cancelled appointments free their slot back up
  const bookings = await Appointment.find({
    doctorId,
    appointmentDate: selectedDate,
    status: { $ne: "cancelled" },
    ...(excludeAppointmentId ? { _id: { $ne: excludeAppointmentId } } : {}),
  });
  const holds = await getHoldsForDay(doctorId, selectedDate, excludeHoldId);
  return { blocks, bookings, holds };
};

/**
 * True when [slotStart, slotEnd] overlaps any leave block on selectedDate.
 * Handles single-day partial leaves, start/end/middle days of multi-day
 * leaves, and full-day blocks (times default to 0..1440).
 */
export const isSlotBlockedByLeave = (
  blocks: LeaveBlock[],
  selectedDate: Date,
  slotStart: number,
  slotEnd: number,
): boolean => {
  return blocks.some((block) => {
    const currentDate = selectedDate.getTime();
    const startDate = block.startingDate.getTime();
    const endDate = block.endingDate ? block.endingDate.getTime() : startDate;

    // Single-day (partial or full) leave
    if (currentDate === startDate && currentDate === endDate) {
      const bStart = block.startingTime ? timeToMinutes(block.startingTime) : 0;
      const bEnd = block.endingTime ? timeToMinutes(block.endingTime) : 1440;
      return slotStart < bEnd && slotEnd > bStart;
    }

    // Starting day of a multi-day leave
    if (currentDate === startDate) {
      const blockStart = block.startingTime ? timeToMinutes(block.startingTime) : 0;
      return slotStart < 1440 && slotEnd > blockStart;
    }
    // Ending day of a multi-day leave
    if (block.endingDate && currentDate === endDate) {
      const blockEnd = block.endingTime ? timeToMinutes(block.endingTime) : 1440;
      return slotStart < blockEnd && slotEnd > 0;
    }
    // Middle of a multi-day leave
    if (currentDate > startDate && currentDate < endDate) return true;

    return false;
  });
};

export const isSlotOverlappingBookings = (
  bookings: Booking[],
  slotStart: number,
  slotEnd: number,
): boolean => {
  return bookings.some((booking) => {
    const start = timeToMinutes(booking.timeSlot);
    const end = start + Number(booking.durationInMinutes);
    return slotStart < end && slotEnd > start;
  });
};

/** True when [slotStart, slotEnd] overlaps any active reservation. */
export const isSlotOverlappingHolds = (
  holds: (Booking & { _id?: unknown; patientId?: unknown })[],
  slotStart: number,
  slotEnd: number,
): boolean => {
  return holds.some((hold) => {
    const start = timeToMinutes(hold.timeSlot);
    const end = start + Number(hold.durationInMinutes);
    return slotStart < end && slotEnd > start;
  });
};

/**
 * Starting slots a doctor actually has open on a date, after leaves,
 * overlapping bookings, active holds and (for the current clinic day) the
 * buffered now + 15 min window. Returns [] for a full-day leave.
 */
export const getAvailableSlotsFor = async (
  doctorId: string,
  selectedDate: Date,
  durationInMinutes: number,
  excludeHoldId?: string,
): Promise<string[]> => {
  const { blocks, bookings, holds } = await getDayContext(
    doctorId,
    selectedDate,
    undefined,
    excludeHoldId,
  );

  if (blocks.some((b) => b.type === "full-day")) return [];

  return MASTER_SLOTS.filter((slot) => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + durationInMinutes;

    if (isClinicToday(selectedDate)) {
      if (slotStart < getClinicNowMinutes() + 15) return false;
    }

    if (isSlotBlockedByLeave(blocks, selectedDate, slotStart, slotEnd)) {
      return false;
    }

    if (isSlotOverlappingBookings(bookings, slotStart, slotEnd)) {
      return false;
    }

    return !isSlotOverlappingHolds(holds, slotStart, slotEnd);
  });
};

export type SlotState = "free" | "held-by-me" | "held" | "taken";
export type SlotStateInfo = { timeSlot: string; state: SlotState };

/**
 * Every starting slot on a date with its live state, for the movie-style
 * booking screen (free / held by me / held by someone else / taken).
 * "Taken" covers real bookings, leave blocks and the now+15min buffer on
 * the current clinic day. When patientId is supplied, that patient's own
 * active hold is labelled "held-by-me" instead of "held".
 */
export const getSlotStatesFor = async (
  doctorId: string,
  selectedDate: Date,
  durationInMinutes: number,
  patientId?: string,
): Promise<SlotStateInfo[]> => {
  const { blocks, bookings, holds } = await getDayContext(doctorId, selectedDate);

  if (blocks.some((b) => b.type === "full-day")) {
    return MASTER_SLOTS.map((timeSlot) => ({ timeSlot, state: "taken" as const }));
  }

  const overlapsHold = (hold: { timeSlot: string; durationInMinutes: number }, start: number, end: number) => {
    const hStart = timeToMinutes(hold.timeSlot);
    const hEnd = hStart + Number(hold.durationInMinutes);
    return start < hEnd && end > hStart;
  };

  return MASTER_SLOTS.map((timeSlot) => {
    const slotStart = timeToMinutes(timeSlot);
    const slotEnd = slotStart + durationInMinutes;

    if (isClinicToday(selectedDate)) {
      if (slotStart < getClinicNowMinutes() + 15) return { timeSlot, state: "taken" as const };
    }

    if (isSlotBlockedByLeave(blocks, selectedDate, slotStart, slotEnd)) {
      return { timeSlot, state: "taken" as const };
    }

    if (isSlotOverlappingBookings(bookings, slotStart, slotEnd)) {
      return { timeSlot, state: "taken" as const };
    }

    if (patientId && holds.some((h) => String(h.patientId) === patientId && overlapsHold(h, slotStart, slotEnd))) {
      return { timeSlot, state: "held-by-me" as const };
    }

    if (isSlotOverlappingHolds(holds, slotStart, slotEnd)) {
      return { timeSlot, state: "held" as const };
    }

    return { timeSlot, state: "free" as const };
  });
};