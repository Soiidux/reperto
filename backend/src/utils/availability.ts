import { MASTER_SLOTS } from "../constants/slots";
import Leave from "../db/models/leave.model";
import Appointment from "../db/models/appointment.model";
import { isClinicToday, getClinicNowMinutes } from "../utils/clinicDate";

/**
 * Shared availability math. Booking-time enforcement (assertSlotAvailable),
 * the slots picker (getAvailableSlots) and leave-conflict suggestion
 * generation all use these helpers so "available" means the same thing
 * everywhere.
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

/** Leaves + active bookings for one doctor on one clinic day. */
export const getDayContext = async (
  doctorId: string,
  selectedDate: Date,
  excludeAppointmentId?: string,
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
  return { blocks, bookings };
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

/**
 * Starting slots a doctor actually has open on a date, after leaves,
 * overlapping bookings and (for the current clinic day) the buffered
 * now + 15 min window. Returns [] for a full-day leave.
 */
export const getAvailableSlotsFor = async (
  doctorId: string,
  selectedDate: Date,
  durationInMinutes: number,
): Promise<string[]> => {
  const { blocks, bookings } = await getDayContext(doctorId, selectedDate);

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

    return !isSlotOverlappingBookings(bookings, slotStart, slotEnd);
  });
};