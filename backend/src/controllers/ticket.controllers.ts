import { Request, Response } from "express";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import Appointment from "../db/models/appointment.model";
import { drawLetterhead, drawFooter } from "../utils/pdfLetterhead";
import { qrDataUrl } from "../utils/qr";
import { canActForPatient } from "../utils/patientScope";

/**
 * Patient-facing ticket for a booking: a QR reference (rendered both as a PNG
 * for the confirmation screen and inside a printable A4 PDF) that the clinic
 * can scan at check-in. Access is scoped the same way as appointment views.
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

/** Printable appointment ticket PDF with the QR in the corner. */
export const getAppointmentTicket = async (req: Request, res: Response) => {
  const appointment = await loadScopedAppointment(req, res);
  if (!appointment) return;

  const patient: any = appointment.patientId;
  const doctor: any = appointment.doctorId;

  const doc = new PDFDocument({ margin: 48, size: "A4" });
  const isDownload = req.query.download === "1";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${isDownload ? "attachment" : "inline"}; filename="appointment-ticket-${appointment._id}.pdf"`,
  );

  doc.pipe(res);
  try {
    drawLetterhead(doc);

    doc.font("Helvetica-Bold").fillColor("#111111").fontSize(15).text("APPOINTMENT TICKET", { align: "center" });
    doc.moveDown(0.3);
    doc.font("Helvetica").fillColor("#666666").fontSize(9).text(
      "Show this ticket (paper or phone) at the reception desk to check in.",
      { align: "center" },
    );
    doc.moveDown(1.2);

    const date = new Date(appointment.appointmentDate).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
    const age = patient?.dateOfBirth
      ? Math.max(0, Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000)))
      : null;
    const doctorDisplayName = (doctor?.name || "").replace(/^Dr\.?\s+/i, "");

    const rows: Array<[string, string]> = [
      ["Patient", `${patient?.name || "-"}${age !== null ? ` (${age} yrs)` : ""}`],
      ["Gender", patient?.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : "-"],
      ["Doctor", `Dr. ${doctorDisplayName}`],
      ["Date", date],
      ["Time", appointment.timeSlot],
      ["Duration", `${appointment.durationInMinutes} minutes`],
      ["Consultation", appointment.consultationType],
    ];

    const labelW = 150;
    const valueX = 48 + labelW;
    let y = doc.y;

    // Thin card background behind the details
    doc.save();
    doc.rect(48, y - 14, doc.page.width - 96, rows.length * 28 + 28).fill("#f6f9f6");
    doc.restore();

    for (const [label, value] of rows) {
      doc.font("Helvetica").fillColor("#555555").fontSize(9.5).text(label.toUpperCase(), 48 + 12, y, { width: labelW - 12 });
      doc.font("Helvetica-Bold").fillColor("#111111").fontSize(11).text(value, valueX, y);
      y += 28;
    }

    // QR bottom-left above the footer band, ref code beside it, and the
    // friendly instructions just above the QR row (never overlapping).
    const ref = `Appointment Ref: ${appointment._id}`;
    const qrSize = 74;
    const qrY = doc.page.height - 34 - qrSize - 8;
    try {
      const qr = await qrDataUrl(ticketRef(appointment), 150);
      doc.image(qr, 48, qrY, { width: qrSize, height: qrSize });
    } catch (qrError) {
      console.warn("Could not embed ticket QR code:", qrError);
    }
    doc.font("Helvetica").fillColor("#666666").fontSize(8).text(
      ref,
      48 + qrSize + 12,
      qrY + qrSize / 2 - 4,
      { width: doc.page.width - 48 - qrSize - 60 },
    );
    doc.font("Helvetica").fillColor("#555555").fontSize(9.5).text(
      "Please arrive a few minutes early. Rescheduling or cancellation is available from the Reperto portal.",
      48,
      qrY - 48,
      { width: doc.page.width - 96, align: "left" },
    );

    drawFooter(doc, "This is a computer-generated appointment ticket.");
    doc.end();
  } catch (error) {
    if (!res.headersSent) throw error;
    res.end();
  }
};