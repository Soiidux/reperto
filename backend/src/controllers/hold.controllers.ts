import { Request, Response } from "express";
import mongoose from "mongoose";
import BookingHold from "../db/models/bookingHold.model";
import Appointment from "../db/models/appointment.model";
import User from "../db/models/user.model";
import { ApiError } from "../errors";
import { getClinicTodayAnchor, parseDateAnchor } from "../utils/clinicDate";
import { canActForPatient } from "../utils/patientScope";
import { createInAppNotification, notifyPatient } from "../utils/notifications";
import {
  sendAppointmentConfirmationEmail,
  assertSlotAvailable,
  formatDateLabel,
  getPatientName,
} from "./appointment.controllers";
import { HOLD_DURATION_MS, HOLD_DURATION_SECONDS } from "../constants/hold";

/**
 * Movie-style booking: patients reserve a time chip for a few minutes
 * (createHold), fill in their visit details at their own pace, then convert
 * the reservation into a real booking (bookFromHold). Expired or abandoned
 * holds are cleaned up automatically by MongoDB's TTL index on expiresAt.
 */

export const createHold = async (req: Request, res: Response) => {
  const {
    doctorId,
    appointmentDate,
    timeSlot,
    durationInMinutes,
    consultationType,
    patientId: requestedPatientId,
  } = req.body;

  // Patients may hold a slot for themselves or for a family member they
  // look after; the hold is keyed to whoever will actually be the patient.
  let targetPatientId: string;
  let bookedBy: string | undefined;
  if (requestedPatientId && requestedPatientId !== req.user.id) {
    if (!mongoose.isValidObjectId(requestedPatientId)) {
      throw new ApiError(400, "Invalid patient id");
    }
    if (!(await canActForPatient(req.user.id, requestedPatientId))) {
      throw new ApiError(403, "You are not authorized to book for this patient");
    }
    targetPatientId = requestedPatientId;
    bookedBy = req.user.id;
  } else {
    targetPatientId = req.user.id;
  }

  const doctor = await User.findOne({ _id: doctorId, role: "doctor", isActive: true });
  if (!doctor) {
    return res
      .status(404)
      .json({ success: false, message: "Selected doctor not found", data: null });
  }

  const selectedDate = parseDateAnchor(appointmentDate);
  if (!selectedDate) throw new ApiError(400, "Invalid appointment date format");
  if (selectedDate < getClinicTodayAnchor()) {
    throw new ApiError(400, "Selected date cannot be in the past");
  }

  // Instant feedback for the one-appointment rule: no point reserving a slot
  // when the patient already has a live booking.
  const activeBooking = await Appointment.findOne({
    patientId: targetPatientId,
    status: { $in: ["pending", "arrived"] },
  });
  if (activeBooking) {
    throw new ApiError(
      400,
      "You already have an upcoming appointment; cancel or complete it before booking another",
    );
  }

  // Same availability rules the real booking enforces — a chip that shows as
  // free must really be free (leave, overlapping bookings, other holds).
  await assertSlotAvailable(
    doctorId,
    selectedDate,
    timeSlot,
    Number(durationInMinutes),
  );

  const hold = new BookingHold({
    patientId: targetPatientId,
    doctorId,
    appointmentDate: selectedDate,
    timeSlot,
    durationInMinutes: Number(durationInMinutes),
    consultationType,
    status: "active",
    expiresAt: new Date(Date.now() + HOLD_DURATION_MS),
    ...(bookedBy ? { bookedBy } : {}),
  });

  await hold.save().catch((error: any) => {
    if (error?.code === 11000) {
      if (error?.keyPattern?.patientId) {
        throw new ApiError(
          409,
          "You're already holding a slot — finish that booking or release it first",
        );
      }
      throw new ApiError(409, "That slot was just taken by someone else");
    }
    throw error;
  });

  res.status(201).json({
    success: true,
    message: "Slot held for you — complete the booking within the countdown",
    data: {
      hold: {
        id: hold._id,
        doctorId: hold.doctorId,
        appointmentDate: hold.appointmentDate,
        timeSlot: hold.timeSlot,
        durationInMinutes: hold.durationInMinutes,
        consultationType: hold.consultationType,
        expiresAt: hold.expiresAt,
      },
      expiresInSeconds: HOLD_DURATION_SECONDS,
    },
  });
};

export const bookFromHold = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { intakeDetails } = req.body;

  const hold = await BookingHold.findById(id);
  if (!hold) {
    throw new ApiError(404, "Hold not found");
  }
  if (hold.status !== "active") {
    throw new ApiError(400, "This hold is no longer active");
  }
  if (hold.expiresAt.getTime() <= Date.now()) {
    throw new ApiError(400, "This slot hold has expired — please pick a new slot");
  }

  const patientId = String(hold.patientId);
  if (!(await canActForPatient(req.user.id, patientId))) {
    throw new ApiError(403, "You are not authorized to complete this booking");
  }

  // The doctor's availability may have changed while the patient filled in
  // their details — re-verify everything, excluding this patient's own hold.
  const doctor = await User.findOne({ _id: hold.doctorId, role: "doctor", isActive: true });
  if (!doctor) {
    throw new ApiError(400, "This doctor is no longer available");
  }
  if (hold.appointmentDate < getClinicTodayAnchor()) {
    throw new ApiError(400, "The selected date has passed");
  }

  const activeBooking = await Appointment.findOne({
    patientId,
    status: { $in: ["pending", "arrived"] },
  });
  if (activeBooking) {
    throw new ApiError(
      400,
      "You already have an upcoming appointment; cancel or complete it before booking another",
    );
  }

  await assertSlotAvailable(
    String(hold.doctorId),
    hold.appointmentDate,
    hold.timeSlot,
    Number(hold.durationInMinutes),
    undefined,
    String(hold._id),
  );

  const appointment = new Appointment({
    patientId: hold.patientId,
    doctorId: hold.doctorId,
    appointmentDate: hold.appointmentDate,
    timeSlot: hold.timeSlot,
    durationInMinutes: hold.durationInMinutes,
    consultationType: hold.consultationType,
    intakeDetails,
    status: "pending",
    bookedBy: hold.bookedBy,
  });

  await appointment.save().catch((error: any) => {
    if (error?.code === 11000) {
      if (error?.keyPattern?.patientId) {
        throw new ApiError(409, "Conflict: You already have an upcoming appointment");
      }
      throw new ApiError(409, "Conflict: This slot was just taken by someone else!");
    }
    throw error;
  });

  // The reservation is spent; release it so the hold index frees the slot.
  await BookingHold.updateOne({ _id: hold._id }, { status: "converted" });

  sendAppointmentConfirmationEmail(appointment, doctor?.name).catch((error: any) => {
    console.error("Failed to send booking confirmation email:", error);
  });

  try {
    const patientName = await getPatientName(patientId);
    await notifyPatient(patientId, {
      type: "appointment-status",
      title: "Appointment booked",
      body: `Your appointment with ${doctor?.name || "your doctor"} on ${formatDateLabel(
        hold.appointmentDate,
      )} at ${hold.timeSlot} is confirmed.`,
      link: `/patient/appointments/${appointment._id}`,
      appointmentId: appointment._id,
    });
    await createInAppNotification(hold.doctorId, {
      type: "appointment-status",
      title: "New appointment",
      body: `${patientName} booked a ${hold.consultationType} appointment on ${formatDateLabel(
        hold.appointmentDate,
      )} at ${hold.timeSlot}.`,
      link: `/doctor/appointments/${appointment._id}`,
      appointmentId: appointment._id,
    });
  } catch (error) {
    console.error("Failed to send booking notifications:", error);
  }

  res.status(201).json({
    success: true,
    message: "Appointment booked successfully",
    data: appointment,
  });
};

export const releaseHold = async (req: Request, res: Response) => {
  const { id } = req.params;

  const hold = await BookingHold.findById(id);
  if (!hold) {
    throw new ApiError(404, "Hold not found");
  }
  if (hold.status !== "active") {
    // Already spent or already freed — idempotent success
    return res.status(200).json({ success: true, message: "Hold released", data: null });
  }
  if (!(await canActForPatient(req.user.id, String(hold.patientId)))) {
    throw new ApiError(403, "You are not authorized to release this hold");
  }

  // Marked released; the TTL index sweeps the document up shortly after.
  await BookingHold.updateOne({ _id: hold._id }, { status: "released" });

  res.status(200).json({ success: true, message: "Hold released", data: null });
};