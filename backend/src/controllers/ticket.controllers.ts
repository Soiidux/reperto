import { Request, Response } from "express";
import mongoose from "mongoose";
import QRCode from "qrcode";
import Appointment from "../db/models/appointment.model";
import { canActForPatient } from "../utils/patientScope";
import { getClinicTodayAnchor, formatDateLabel } from "../utils/clinicDate";
import { notifyPatientArrived } from "../utils/notifications";
import { parseTicketReference, ticketRef, verifyTicket } from "../utils/ticket";

/**
 * Patient-facing ticket for a booking: a machine-verifiable QR reference
 * (rendered as a PNG for the confirmation screen) that the clinic can scan
 * at check-in. Access is scoped the same way as appointment views.
 */

const toId = (value: unknown): string => {
  const asDoc = value as { _id?: unknown } | null;
  if (asDoc && typeof asDoc === "object" && "_id" in asDoc) return String(asDoc._id);
  return String(value);
};

// Loads the appointment (populated for display) or sends an error and returns null.
const loadScopedAppointment = async (req: Request, res: Response) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate("patientId", "name gender dateOfBirth bloodGroup")
    .populate("doctorId", "name doctorProfile")
    .populate("bookedBy", "name");

  if (!appointment) {
    res.status(404).json({ success: false, message: "Appointment not found", data: null });
    return null;
  }

  const patientId = toId(appointment.patientId);
  const doctorId = toId(appointment.doctorId);
  const isPatient = req.user.role === "patient" && !(await canActForPatient(req.user.id, patientId));
  const isDoctor = req.user.role === "doctor" && doctorId !== req.user.id;
  if (isPatient || isDoctor) {
    res.status(403).json({
      success: false,
      message: "You are not authorized to view this.",
      data: null,
    });
    return null;
  }

  return appointment;
};

/** Machine-verifiable QR as a PNG (for embedding in the confirmation screen). */
export const getAppointmentTicketQr = async (req: Request, res: Response) => {
  const appointment = await loadScopedAppointment(req, res);
  if (!appointment) return;

  const png = await QRCode.toBuffer(ticketRef(appointment), {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#111111", light: "#ffffff" },
  });

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Content-Disposition", `inline; filename="ticket-qr-${appointment._id}.png"`);
  res.send(png);
};

/**
 * Reception check-in: verify a scanned/typed ticket code and move the patient
 * to "arrived". Idempotent — a second scan of the same ticket reports the
 * patient was already checked in.
 */
export const checkInByTicket = async (req: Request, res: Response) => {
  const { code } = (req.body ?? {}) as { code?: string };

  const parsed = parseTicketReference(code ?? "");
  if (!parsed) {
    return res.status(400).json({
      success: false,
      message:
        "That doesn't look like a valid ticket. Scan the QR from the booking confirmation, or enter the full code.",
      data: null,
    });
  }

  const appointment = await Appointment.findById(parsed.appointmentId)
    .populate("patientId", "name")
    .populate("doctorId", "name");

  if (!appointment) {
    return res.status(404).json({
      success: false,
      message: "No appointment matches this ticket.",
      data: null,
    });
  }

  // The desk checks patients in on the appointment's clinic day.
  const todayAnchor = getClinicTodayAnchor();
  if (appointment.appointmentDate.getTime() !== todayAnchor.getTime()) {
    return res.status(400).json({
      success: false,
      message: `This ticket is for ${formatDateLabel(appointment.appointmentDate)}, which isn't today.`,
      data: null,
    });
  }

  if (appointment.status !== "pending" && appointment.status !== "arrived") {
    return res.status(409).json({
      success: false,
      message: `This appointment is ${appointment.status} and can no longer be checked in.`,
      data: null,
    });
  }

  const justCheckedIn = appointment.status === "pending";
  if (justCheckedIn) {
    appointment.status = "arrived";
    appointment.checkedInAt = new Date();
    appointment.checkedInBy = new mongoose.Types.ObjectId(req.user.id);
    await appointment.save();
    try {
      await notifyPatientArrived(appointment);
    } catch (error) {
      console.error("Failed to send arrival notification:", error);
    }
  }

  const verification = verifyTicket(appointment, parsed);
  const patient = appointment.patientId as { _id?: unknown; name?: string } | null;
  const doctor = appointment.doctorId as { _id?: unknown; name?: string } | null;

  res.status(200).json({
    success: true,
    message: justCheckedIn ? "Patient checked in" : "Patient was already checked in",
    data: {
      appointment: {
        _id: appointment._id,
        appointmentDate: appointment.appointmentDate,
        timeSlot: appointment.timeSlot,
        consultationType: appointment.consultationType,
        status: appointment.status,
        checkedInAt: appointment.checkedInAt ?? null,
        patient: { _id: patient?._id ?? appointment.patientId, name: patient?.name ?? "Patient" },
        doctor: { _id: doctor?._id ?? appointment.doctorId, name: doctor?.name ?? "Doctor" },
      },
      alreadyCheckedIn: !justCheckedIn,
      staleDate: verification.staleDate ?? false,
      slotMismatch: verification.slotMismatch ?? false,
    },
  });
};