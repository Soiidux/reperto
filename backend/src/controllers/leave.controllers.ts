import { Request, Response } from 'express';
import mongoose from "mongoose";
import Leave from "../db/models/leave.model";
import Appointment from "../db/models/appointment.model";
import User from "../db/models/user.model";
import { ApiError } from "../errors";
import { getClinicTodayAnchor, parseDateAnchor } from "../utils/clinicDate";
import { sendEmail, rescheduleNoticeEmailHtml, resolveRecipientEmail } from "../utils/email";
import { notifyPatient } from "../utils/notifications";
import {
  timeToMinutes,
  getDayContext,
  isSlotBlockedByLeave,
  getAvailableSlotsFor,
} from "../utils/availability";

const RESCHEDULE_WINDOW_DAYS = 14;
const SUGGESTIONS_PER_APPOINTMENT = 3;

const formatDateLabel = (date: Date) =>
  new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Up to 3 alternative slots in the days after the appointment, reusing the
 * same availability math as booking so a suggestion is always valid at
 * generation time. The original slot is preferred when it is still free.
 */
const generateSuggestions = async (
  doctorId: string,
  appointment: any,
): Promise<{ date: Date; timeSlot: string }[]> => {
  const suggestions: { date: Date; timeSlot: string }[] = [];
  const originalDate = appointment.appointmentDate.getTime();
  const duration = Number(appointment.durationInMinutes);

  for (
    let offset = 1;
    offset <= RESCHEDULE_WINDOW_DAYS && suggestions.length < SUGGESTIONS_PER_APPOINTMENT;
    offset++
  ) {
    const candidateDate = new Date(originalDate + offset * 86400000);
    const slots = await getAvailableSlotsFor(doctorId, candidateDate, duration);
    if (slots.length === 0) continue;

    if (slots.includes(appointment.timeSlot)) {
      suggestions.push({ date: candidateDate, timeSlot: appointment.timeSlot });
    }
    for (const slot of slots) {
      if (suggestions.length >= SUGGESTIONS_PER_APPOINTMENT) break;
      if (slot === appointment.timeSlot) continue;
      suggestions.push({ date: candidateDate, timeSlot: slot });
    }
  }

  return suggestions;
};

/** Emails the patient (or their guardian for dependent accounts) about the conflict. */
const notifyPatientAboutConflict = async (
  doctorId: string,
  appointment: any,
  suggestions: { date: Date; timeSlot: string }[],
) => {
  try {
    const doctor = await User.findById(doctorId).select("name").lean();
    const recipientEmail = await resolveRecipientEmail(appointment.patientId);
    if (!recipientEmail) return;

    await sendEmail({
      to: recipientEmail,
      subject: "Your appointment needs rescheduling",
      html: rescheduleNoticeEmailHtml({
        doctorName: doctor?.name || "your doctor",
        originalDate: formatDateLabel(appointment.appointmentDate),
        originalTime: appointment.timeSlot,
        suggestions: suggestions.map((s) => ({
          date: formatDateLabel(s.date),
          timeSlot: s.timeSlot,
        })),
      }),
    });
  } catch (error) {
    console.error("Failed to send reschedule notice:", error);
  }
};

/**
 * Flags every active appointment that overlaps the new leave, stores up to
 * three alternative slots on it, and notifies the patient. Returns a summary
 * of the conflicts so the response can surface them to the doctor.
 */
const resolveLeaveConflicts = async (
  doctorId: string,
  leave: any,
) => {
  const from = new Date(leave.startingDate);
  const to = leave.endingDate ? new Date(leave.endingDate) : new Date(leave.startingDate);

  const doctor = await User.findById(doctorId).select("name").lean();
  const doctorLabel = doctor?.name || "Your doctor";

  const candidates = await Appointment.find({
    doctorId,
    status: { $in: ["pending", "arrived"] },
    needsReschedule: { $ne: true },
    appointmentDate: { $gte: from, $lte: to },
  });

  const conflicts: any[] = [];

  for (const appointment of candidates) {
    const slotStart = timeToMinutes(appointment.timeSlot);
    const slotEnd = slotStart + Number(appointment.durationInMinutes);

    // Same overlap math the booking path uses, so "conflict" == "blocked"
    if (!isSlotBlockedByLeave([leave], appointment.appointmentDate, slotStart, slotEnd)) {
      continue;
    }

    const suggestions = await generateSuggestions(doctorId, appointment);
    appointment.needsReschedule = true;
    appointment.rescheduleSuggestions = suggestions;
    await appointment.save();

    await notifyPatientAboutConflict(doctorId, appointment, suggestions);
    await notifyPatient(appointment.patientId, {
      type: "leave-conflict",
      title: "Your appointment needs rescheduling",
      body: `${doctorLabel} is on leave during your appointment on ${formatDateLabel(
        appointment.appointmentDate,
      )} at ${appointment.timeSlot}. Pick a new time for your visit.`,
      link: `/patient/appointments/${appointment._id}`,
      appointmentId: appointment._id,
    });

    conflicts.push({
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      originalDate: appointment.appointmentDate,
      timeSlot: appointment.timeSlot,
      suggestions,
    });
  }

  return conflicts;
};

export const addLeave = async (req: Request, res: Response) => {
  try {
    const { type, startingDate, startingTime, endingDate, endingTime, reason } = req.body;
    const doctorId = req.user.id;
    const normalizedStart = parseDateAnchor(startingDate);
    if (!normalizedStart) {
      throw new ApiError(400, "Invalid starting date format");
    }
    if (normalizedStart < getClinicTodayAnchor()) {
        return res
          .status(400)
          .json({ message: "Selected date cannot be in the past" });
    }
    
    let normalizedEnd: Date = null;
    
    if(endingDate) {
        normalizedEnd = parseDateAnchor(endingDate);
        if (!normalizedEnd) {
          throw new ApiError(400, "Invalid ending date format");
        }
        if (normalizedEnd < normalizedStart) {
            return res
                .status(400)
                .json({ message: "Ending date cannot be before starting date" });
        }
    }
    
    const overlappingLeave = await Leave.findOne({
      doctorId,
      $or: [
        {
          // Case: New leave starts inside an existing leave
          startingDate: { $lte: normalizedStart },
          endingDate: { $gte: normalizedStart }
        },
        {
          // Case: New leave ends inside an existing leave
          startingDate: { $lte: normalizedEnd },
          endingDate: { $gte: normalizedEnd }
        },
        {
          // Case: New leave completely swallows an existing leave
          startingDate: { $gte: normalizedStart },
          endingDate: { $lte: normalizedEnd }
        }
      ]
    });
    if (overlappingLeave) {
      // Logic for partial blocks: You might want to allow multiple 'emergency' blocks on one day
      // But for 'full-day', we definitely block duplicates.
      if (type === 'full-day' || overlappingLeave.type === 'full-day') {
        return res.status(400).json({ 
          success: false, 
          message: "A leave record already exists that overlaps with this date range." 
        });
      }
    }
    
    const leave = new Leave({
      doctorId,
      type,
      startingDate: normalizedStart,
      endingDate: normalizedEnd,
      startingTime,
      endingTime,
      reason
    });
    
    await leave.save();

    // Resolver: flag overlapping bookings and suggest alternatives to patients
    const conflicts = await resolveLeaveConflicts(doctorId, leave);

    if (conflicts.length > 0) {
      return res.status(201).json({
        success: true,
        message: `Leave added. ${conflicts.length} appointment(s) flagged for rescheduling.`,
        data: { leave, conflictsHandled: conflicts.length, conflicts },
      });
    }
    
    return res.status(201).json({ success: true, message: "Leave record added successfully" , data: leave });
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new ApiError(409, "A leave record already exists for this date.");
    }
    throw error;
  }
};

export const getLeaves = async (req: Request, res: Response) => {
  const doctorId = req.user.id;
  const leaves = await Leave.find({ doctorId }).sort({ startingDate: -1 });
  return res.status(200).json({
    success: true,
    message: "Leave records fetched successfully",
    data: leaves,
  });
};

/**
 * When a leave is removed, re-check the appointments it used to cover:
 * any that are no longer blocked by a remaining leave get their flag and
 * suggestions cleared, so patients aren't nudged to move an available slot.
 */
const clearResolvedConflicts = async (doctorId: string, leave: any) => {
  const from = new Date(leave.startingDate);
  const to = leave.endingDate ? new Date(leave.endingDate) : new Date(leave.startingDate);

  const affected = await Appointment.find({
    doctorId,
    status: { $in: ["pending", "arrived"] },
    needsReschedule: true,
    appointmentDate: { $gte: from, $lte: to },
  });

  for (const appointment of affected) {
    const { blocks } = await getDayContext(doctorId, appointment.appointmentDate);
    const slotStart = timeToMinutes(appointment.timeSlot);
    const slotEnd = slotStart + Number(appointment.durationInMinutes);

    if (!isSlotBlockedByLeave(blocks, appointment.appointmentDate, slotStart, slotEnd)) {
      appointment.needsReschedule = false;
      appointment.rescheduleSuggestions = [];
      await appointment.save();
    }
  }
};

export const removeLeave = async (req: Request, res: Response) => {
  const { leaveId } = req.params;
  const doctorId = req.user.id;

  // Ensure the leave belongs to the doctor trying to delete it
  const leave = await Leave.findOneAndDelete({ _id: leaveId, doctorId });

  if (!leave) {
    return res.status(404).json({ 
      success: false, 
      message: "Leave record not found or unauthorized" 
    });
  }

  await clearResolvedConflicts(doctorId, leave);

  res.status(200).json({
    success: true,
    message: "Leave removed successfully"
  });
};