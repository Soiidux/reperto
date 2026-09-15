import { Request, Response } from 'express';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import Invoice from '../db/models/invoice.model';
import Consultation from '../db/models/consultation.model';
import { canActForPatient, resolvePatientScope } from '../utils/patientScope';
import { generateInvoiceNumber } from '../utils/invoiceNumber';
import { drawLetterhead, drawFooter } from '../utils/pdfLetterhead';
import { ApiError } from '../errors';

const unauthorizedResponse: ApiResponse<null> = {
  success: false,
  message: 'You are not authorized to view this.',
  data: null,
};

const isValidObjectId = (value: unknown): value is string =>
  typeof value === 'string' && mongoose.isValidObjectId(value);

const getInvoiceOr404 = async (id: string) => {
  const invoice = await Invoice.findById(id)
    .populate('patientId', 'name profileImageUrl')
    .populate('doctorId', 'name profileImageUrl');
  return invoice;
};

const assertCanViewInvoice = async (
  user: { id: string; role: string },
  invoice: any,
) => {
  const patientId = String(invoice.patientId?._id ?? invoice.patientId);
  const doctorId = String(invoice.doctorId?._id ?? invoice.doctorId);
  const isAuthorized =
    (user.role === 'patient' && (await canActForPatient(user.id, patientId))) ||
    (user.role === 'doctor' && doctorId === user.id) ||
    user.role === 'staff' ||
    user.role === 'admin';

  if (!isAuthorized) {
    throw new ApiError(403, 'You are not authorized to view this.');
  }
};

/**
 * Shared generator used by the POST endpoint and auto-emitted inside
 * `createConsultation`. Returns the already-issued invoice when called
 * twice for the same consultation (idempotent).
 */
export const buildInvoiceForConsultation = async (consultationId: string) => {
  const existing = await Invoice.findOne({ consultationId });
  if (existing) return existing;

  const consultation = await Consultation.findById(consultationId)
    .populate('patientId', 'name')
    .populate('doctorId', 'name doctorProfile')
    .populate('appointmentId', 'consultationType');
  if (!consultation) return null;

  const patient: any = consultation.patientId;
  const doctor: any = consultation.doctorId;
  const appointment: any = consultation.appointmentId;

  const amount = doctor?.doctorProfile?.consultationFee ?? 0;

  const invoice = await Invoice.create({
    patientId: consultation.patientId,
    doctorId: consultation.doctorId,
    consultationId,
    appointmentId: consultation.appointmentId,
    invoiceNumber: await generateInvoiceNumber(),
    amount,
    doctorName: doctor?.name || 'Unknown Doctor',
    patientName: patient?.name || 'Unknown Patient',
    consultationType: appointment?.consultationType || 'Follow-up',
    consultationDate: appointment?.appointmentDate || (consultation as any).createdAt,
  });

  return invoice;
};

// ---- POST /api/invoice/consultation/:consultationId ----
export const generateInvoice = async (req: Request, res: Response) => {
  const { consultationId } = req.params;
  if (!isValidObjectId(consultationId)) {
    throw new ApiError(400, 'Invalid consultation id');
  }

  const consultation = await Consultation.findById(consultationId).select('doctorId');
  if (!consultation) {
    return res.status(404).json({
      success: false,
      message: 'Consultation record not found',
      data: null,
    });
  }

  const isAuthorized =
    (req.user.role === 'doctor' && consultation.doctorId.toString() === req.user.id) ||
    req.user.role === 'staff' ||
    req.user.role === 'admin';
  if (!isAuthorized) {
    return res.status(403).json(unauthorizedResponse);
  }

  const existing = await Invoice.findOne({ consultationId });
  if (existing) {
    return res.status(200).json({
      success: true,
      message: 'Invoice already exists for this consultation',
      data: existing,
    });
  }

  const invoice = await buildInvoiceForConsultation(consultationId);
  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Consultation record not found',
      data: null,
    });
  }

  return res.status(201).json({
    success: true,
    message: 'Invoice generated successfully',
    data: invoice,
  });
};

// ---- GET /api/invoice ----
export const getInvoices = async (req: Request, res: Response) => {
  const { patientId } = req.query;
  const filter: any = {};

  if (req.user.role === 'patient') {
    filter.patientId = { $in: await resolvePatientScope(req.user.id) };
  } else if (req.user.role === 'doctor') {
    filter.doctorId = req.user.id;
  }

  // Optional patient scoping for doctors/staff/admins.
  if (patientId && req.user.role !== 'patient') {
    if (!isValidObjectId(patientId)) {
      throw new ApiError(400, 'Invalid patient id');
    }
    filter.patientId = String(patientId);
  }

  const invoices = await Invoice.find(filter)
    .populate('patientId', 'name profileImageUrl')
    .populate('doctorId', 'name profileImageUrl')
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    message: 'Invoices retrieved successfully',
    data: { count: invoices.length, invoices },
  });
};

// ---- GET /api/invoice/:id ----
export const getInvoice = async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid invoice id');
  }
  const invoice = await getInvoiceOr404(req.params.id);
  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Invoice not found',
      data: null,
    });
  }

  await assertCanViewInvoice(req.user, invoice);

  return res.status(200).json({
    success: true,
    message: 'Invoice retrieved successfully',
    data: invoice,
  });
};

// ---- GET /api/invoice/:id/pdf ----
export const getInvoicePdf = async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid invoice id');
  }
  const invoice = await Invoice.findById(req.params.id)
    .populate('patientId', 'name')
    .populate('doctorId', 'name doctorProfile');
  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Invoice not found',
      data: null,
    });
  }

  await assertCanViewInvoice(req.user, invoice);

  const doc = new PDFDocument({ margin: 48, size: 'A4' });

  const isDownload = req.query.download === '1';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${isDownload ? 'attachment' : 'inline'}; filename="invoice-${(invoice.patientName || 'patient').replace(/\s+/g, '-').toLowerCase()}.pdf"`,
  );

  doc.pipe(res);

  drawLetterhead(doc);

  const PAGE_W = doc.page.width;
  const title = `INVOICE  ${invoice.invoiceNumber}`;
  doc.font('Helvetica-Bold').fillColor('#111111').fontSize(14).text(title, { align: 'center' });
  doc.moveDown(0.3);
  doc.font('Helvetica').fillColor('#666666').fontSize(9).text('This is a computer-generated invoice for your consultation.', { align: 'center' });
  doc.moveDown(1);

  const issuedDate = new Date((invoice as any).createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const consultationDate = new Date(invoice.consultationDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Bill-to + invoice metadata in two columns
  const infoY = doc.y;
  doc.font('Helvetica-Bold').fillColor('#111111').fontSize(11).text('Billed To', 48, infoY);
  doc.font('Helvetica').fontSize(10.5).fillColor('#333333');
  doc.text(invoice.patientName, 48, doc.y + 2);

  const meta = [
    `Invoice Number: ${invoice.invoiceNumber}`,
    `Issued On: ${issuedDate}`,
    `Consultation Date: ${consultationDate}`,
    `Consultation Type: ${invoice.consultationType}`,
    `Status: ${invoice.status.toUpperCase()}`,
  ];
  doc.font('Helvetica-Bold').fillColor('#111111').fontSize(11).text('Details', 360, infoY);
  doc.font('Helvetica').fontSize(10.5).fillColor('#333333');
  meta.forEach((line, i) => {
    doc.font(i === meta.length - 1 ? 'Helvetica-Bold' : 'Helvetica');
    doc.text(line, 360, doc.y + (i === 0 ? 2 : 0));
  });

  doc.x = 48;
  doc.moveDown(1.2);

  // Charges table
  const columnWidths = [330, 170];
  const tableLeft = doc.x;
  const headerY = doc.y;
  const rowH = 26;
  const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
  const rowCount = 3;

  const drawTableRow = (cols: string[], y: number, bold = false, fill?: string) => {
    if (fill) {
      doc.save();
      doc.rect(tableLeft, y, tableWidth, rowH).fill(fill);
      doc.restore();
    }
    let x = tableLeft;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10.5).fillColor('#111111');
    cols.forEach((cell, i) => {
      doc.text(cell, x + 6, y + 7, { width: columnWidths[i] - 12, lineBreak: false, align: i === 1 ? 'right' : 'left' });
      x += columnWidths[i];
    });
  };

  const tableBottom = headerY + rowH * rowCount;
  doc.save();
  doc.strokeColor('#cccccc').lineWidth(0.75);
  doc.moveTo(tableLeft, headerY);
  doc.lineTo(tableLeft + tableWidth, headerY);
  doc.stroke();
  doc.moveTo(tableLeft, tableBottom);
  doc.lineTo(tableLeft + tableWidth, tableBottom);
  doc.stroke();
  let x0 = tableLeft;
  for (let i = 0; i < columnWidths.length; i += 1) {
    doc.moveTo(x0, headerY);
    doc.lineTo(x0, tableBottom);
    doc.stroke();
    x0 += columnWidths[i];
  }
  doc.restore();

  const formatMoney = (value: number) => `₹ ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  drawTableRow(['Description', 'Amount'], headerY, true, '#eef7ee');
  drawTableRow([`Consultation Fee (Dr. ${invoice.doctorName.replace(/^Dr\.?\s+/i, '')})`, formatMoney(invoice.amount)], headerY + rowH * 1, false, '#ffffff');
  drawTableRow(['Total', formatMoney(invoice.amount)], headerY + rowH * 2, true, '#f6f6f6');

  doc.x = 48;
  doc.moveDown(0.8);
  doc.font('Helvetica').fillColor('#666666').fontSize(9).text('This amount is inclusive of all applicable taxes.', { width: PAGE_W - 96 });

  if (doc.y > 720) doc.addPage();
  doc.moveDown(1);
  doc.font('Helvetica').fillColor('#444444').fontSize(11);
  doc.text(`Thank you for choosing Reperto Homeopathic Clinic.`, { align: 'center', width: PAGE_W - 96 });

  drawFooter(doc, 'This is a computer-generated invoice.');
  doc.end();
};

// ---- PATCH /api/invoice/:id/status ----
export const updateInvoiceStatus = async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    throw new ApiError(400, 'Invalid invoice id');
  }
  const invoice = await getInvoiceOr404(req.params.id);
  if (!invoice) {
    return res.status(404).json({
      success: false,
      message: 'Invoice not found',
      data: null,
    });
  }

  const doctorId = String(invoice.doctorId?._id ?? invoice.doctorId);
  const isAuthorized =
    (req.user.role === 'doctor' && doctorId === req.user.id) ||
    req.user.role === 'staff' ||
    req.user.role === 'admin';
  if (!isAuthorized) {
    return res.status(403).json(unauthorizedResponse);
  }

  invoice.status = req.body.status;
  await invoice.save();

  return res.status(200).json({
    success: true,
    message: 'Invoice status updated successfully',
    data: invoice,
  });
};