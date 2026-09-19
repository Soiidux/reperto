import { Request, Response } from "express";
import QRCode from "qrcode";
import Appointment from "../db/models/appointment.model";
import { canActForPatient } from "../utils/patientScope";

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

const ticketRef = (appointment: any) => {
  const date = new Date(appointment.appointmentDate)
    .toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .replace(/\s+/g, "-");
  return `REPERTO_TICKET:${appointment._id}:${date}:${appointment.timeSlot}`;
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

