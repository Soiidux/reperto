import { Request, Response } from 'express';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import Appointment from '../db/models/appointment.model';
import Consultation from '../db/models/consultation.model';
import User from '../db/models/user.model';
import { ApiError } from '../errors';
import { canActForPatient } from '../utils/patientScope';
import { drawLetterhead, drawFooter } from '../utils/pdfLetterhead';
import { buildInvoiceForConsultation } from './invoice.controllers';

const unauthorizedResponse: ApiResponse<null> = {
  success: false,
  message: 'You are not authorized to view this.',
  data: null,
};

const isValidObjectId = (value: unknown): value is string =>
  typeof value === 'string' && mongoose.isValidObjectId(value);

export const createConsultation = async (req: Request, res: Response) => {
  const {
    appointmentId,
    chiefComplaintDetails,
    pastMedicalHistory,
    physicalGenerals,
    mentalGenerals,
    diagnosis,
    prescriptions,
    doctorNotes
  } = req.body;
  
  if (!isValidObjectId(appointmentId)) {
    throw new ApiError(400, 'Invalid appointment id');
  }

  const appointment = await Appointment.findById(appointmentId);
  
  if (!appointment) {
    const appointmentNotFound: ApiResponse<null> = {
      success: false,
      message: 'Appointment not found',
      data: null
    };
    return res.status(404).json(appointmentNotFound);
  }
  
  if (appointment.doctorId.toString() !== req.user.id) {
    return res.status(403).json(unauthorizedResponse);
  }

  // Only document consultations for patients who actually checked in;
  // pending/cancelled/no-show appointments have no consultable visit.
  if (appointment.status !== 'arrived') {
    throw new ApiError(
      400,
      `Consultations can only be created for arrived appointments (current status: ${appointment.status})`,
    );
  }
  
  const existingConsultation = await Consultation.findOne({ appointmentId });
  
  if (existingConsultation) {
    const consultationExists: ApiResponse<null> = {
      success: false,
      message: 'Consultation already exists',
      data: null
    };
    return res.status(400).json(consultationExists);
  }
  
  const consultation = new Consultation({
    appointmentId,
    patientId: appointment.patientId,
    doctorId: req.user.id,
    chiefComplaintDetails,
    pastMedicalHistory,
    physicalGenerals,
    mentalGenerals,
    diagnosis,
    prescriptions,
    doctorNotes
  });
  
  await consultation.save().catch((error: any) => {
    if (error?.code === 11000) {
      throw new ApiError(409, "Consultation already exists");
    }
    throw error;
  });
  appointment.status = 'completed';
  await appointment.save();

  // Auto-generate the invoice for the completed visit. Emission is best
  // effort: a failure here must never break the consultation flow.
  try {
    await buildInvoiceForConsultation(consultation._id.toString());
  } catch (error) {
    console.error('Invoice auto-generation failed:', error);
  }

  const consultationCreated: ApiResponse<typeof consultation> = {
    success: true,
    message: 'Consultation created successfully',
    data: consultation
  };
  return res.status(201).json(consultationCreated);
};

export const getPatientHistory = async (req: Request, res: Response) => {
  let patientId;

  if (req.user.role === 'patient') {
    // Patients may view their own or their dependents' history
    const paramPatientId = String(req.params.patientId);
    if (!isValidObjectId(paramPatientId)) {
      throw new ApiError(400, 'Invalid patient id');
    }
    if (!(await canActForPatient(req.user.id, paramPatientId))) {
      return res.status(403).json(unauthorizedResponse);
    }
    patientId = paramPatientId;
  } else {
    const { patientId: paramPatientId } = req.params;
    if (!isValidObjectId(paramPatientId)) {
      throw new ApiError(400, 'Invalid patient id');
    }
    const patientExists = await User.exists({ _id: paramPatientId });
    if (!patientExists) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
        data: null,
      });
    }
    patientId = paramPatientId;
  }
  
  // An empty history is a valid state (e.g. new patients), not an error:
  // callers render their own empty-state UI from count/history.
  const history = await Consultation.find({ patientId})
    .populate('doctorId', 'name profileImageUrl')
    .populate('patientId', 'name profileImageUrl')
    .populate(
      "appointmentId",
      "appointmentDate consultationType"
    )
    .sort({ createdAt: -1 });

  const response: ApiResponse<{ count: number; history: typeof history }> = {
    success: true,
    message: 'Patient history retrieved successfully',
    data: { count: history.length, history: history }
  };
  
  return res.status(200).json(response);

};

export const getLatestConsultation = async (req: Request, res: Response) => {
  const patientId = String(req.params.patientId);
  if (req.user.role === 'patient' && !(await canActForPatient(req.user.id, patientId))) {
    return res.status(403).json(unauthorizedResponse);
  }
  if (!isValidObjectId(patientId)) {
    throw new ApiError(400, 'Invalid patient id');
  }
  const latest = await Consultation.findOne({ patientId })
    .populate('doctorId', 'name profileImageUrl')
    .sort({ createdAt: -1 })
    .limit(1);

  if (!latest) {
    return res.status(404).json({ 
      success: false, 
      message: 'No completed consultations found for this patient.',
      data: null
    });
  }
  
  const response: ApiResponse<typeof latest> = {
    success: true,
    message: 'Latest consultation retrieved successfully',
    data: latest
  };
  res.status(200).json(response);
};

export const getConsultation = async (req: Request, res: Response) => {
  const { patientId, appointmentId } = req.query;
  
  if (
    req.user.role === 'patient' &&
    !(await canActForPatient(req.user.id, String(patientId)))
  ) {
    return res.status(403).json(unauthorizedResponse);
  }

  // Both filters are required; without them findOne({}) would scan the
  // collection and leak an arbitrary record.
  if (!isValidObjectId(patientId) || !isValidObjectId(appointmentId)) {
    throw new ApiError(400, 'patientId and appointmentId query parameters are required');
  }
  
  const consultation = await Consultation.findOne({appointmentId, patientId })
    .populate('doctorId', 'name profileImageUrl');
  
  if (!consultation) {
    return res.status(404).json({ 
      success: false, 
      message: "Requested completed consultation summary record could not be found.",
      data: null
    });
  }
  
  const response: ApiResponse<typeof consultation> = {
    success: true,
    message: 'Consultation retrieved successfully',
    data: consultation
  };
  res.status(200).json(response);
};

export const getPrescription = async (req: Request, res: Response) => {
  try {
    const consultation = await Consultation.findById(req.params.id)
      .populate('patientId', 'name profileImageUrl gender dateOfBirth bloodGroup')
      .populate('doctorId', 'name doctorProfile')
      .populate('appointmentId', 'appointmentDate');

    if (!consultation) {
      return res.status(404).json({
        success: false,
        message: 'Consultation record not found',
        data: null,
      });
    }

    const role = req.user.role;
    const patientRecordId = consultation.patientId._id.toString();
    const isAuthorized =
      (role === 'patient' && (await canActForPatient(req.user.id, patientRecordId))) ||
      (role === 'doctor' && consultation.doctorId._id.toString() === req.user.id) ||
      role === 'staff' ||
      role === 'admin';

    if (!isAuthorized) {
      return res.status(403).json(unauthorizedResponse);
    }

    const patient: any = consultation.patientId;
    const doctor: any = consultation.doctorId;
    const appointment: any = consultation.appointmentId;

    const doc = new PDFDocument({ margin: 48, size: 'A4' });

    const isDownload = req.query.download === '1';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${isDownload ? 'attachment' : 'inline'}; filename="prescription-${(patient.name || 'patient').replace(/\s+/g, '-').toLowerCase()}.pdf"`,
    );

    doc.pipe(res);

    drawLetterhead(doc);

    doc.font('Helvetica-Bold').fillColor('#111111').fontSize(14).text('PRESCRIPTION', { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fillColor('#666666').fontSize(9).text('This is a computer-generated prescription issued by the consulting clinician.', { align: 'center' });
    doc.moveDown(1);

    const createdAt: any = (consultation as any).createdAt;
    const date = appointment?.appointmentDate
      ? new Date(appointment.appointmentDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : new Date(createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });

    // Patient + doctor info in two columns
    const infoY = doc.y;
    const age = patient.dateOfBirth
      ? Math.max(0, Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000)))
      : null;
    const qualifications = doctor.doctorProfile?.qualifications?.length
      ? doctor.doctorProfile.qualifications.join(', ')
      : '';
    const specializations = doctor.doctorProfile?.specializations?.length
      ? `Specialisation: ${doctor.doctorProfile.specializations.join(', ')}`
      : 'General Homoeopathy Practice';

    doc.font('Helvetica').fillColor('#111111').fontSize(11);
    doc.font('Helvetica-Bold').text('Patient', 48, infoY);
    doc.font('Helvetica').fontSize(10.5).fillColor('#333333');
    doc.text(`Name: ${patient.name || '-'}`, 48, doc.y + 2);
    doc.text(`Age / Gender: ${age ?? '-'} yrs / ${patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : '-'}`);
    doc.text(`Blood Group: ${patient.bloodGroup || '-'}`);

    const doctorDisplayName = (doctor.name || '').replace(/^Dr\.?\s+/i, '');
    doc.font('Helvetica-Bold').fillColor('#111111').fontSize(11).text('Consulting Doctor', 318, infoY);
    doc.font('Helvetica').fontSize(10.5).fillColor('#333333');
    doc.text(`Dr. ${doctorDisplayName}`, 318, doc.y + 2);
    if (qualifications) doc.text(qualifications, 318, doc.y, { width: 230 });
    doc.text(specializations, 318, doc.y, { width: 230 });
    doc.text(`Date: ${date}`, 318, doc.y, { width: 230 });

    // Metadata footer line for the top half
    doc.x = 48;
    doc.moveDown(0.4);

    doc.font('Helvetica-Bold').fillColor('#111111').fontSize(12).text('Diagnosis');
    doc.moveDown(0.25);
    doc.font('Helvetica').fillColor('#333333').fontSize(11).text(consultation.diagnosis || '-');
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fillColor('#111111').fontSize(12).text('Prescribed Remedies');
    doc.moveDown(0.4);

    const PAGE_W = doc.page.width;
    const columnWidths = [180, 90, 130, 90];
    const tableLeft = doc.x;
    const headerY = doc.y;
    const rowH = 26;

    const drawRow = (cols: string[], y: number, bold = false, fill?: string) => {
      if (fill) {
        doc.save();
        doc.rect(tableLeft, y, columnWidths.reduce((a, b) => a + b, 0), rowH).fill(fill);
        doc.restore();
      }
      let x = tableLeft;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10.5).fillColor('#111111');
      cols.forEach((cell, i) => {
        doc.text(cell, x, y + 7, { width: columnWidths[i] - 6, lineBreak: false });
        x += columnWidths[i];
      });
    };
    // Table borders drawn beneath the text columns
    const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
    const tableBottom = headerY + rowH * Math.max(1, consultation.prescriptions?.length || 1);
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

    drawRow(['Remedy', 'Potency', 'Dosage', 'Duration'], headerY, true, '#eef7ee');

    if (!consultation.prescriptions || consultation.prescriptions.length === 0) {
      doc.font('Helvetica').fontSize(10.5).text('No remedies prescribed.', tableLeft + 6, headerY + rowH + 7);
    } else {
      consultation.prescriptions.forEach((p, index) => {
        drawRow(
          [p.remedyName, p.potency || '-', p.dosage, `${p.durationInDays} day(s)`],
          headerY + rowH * (index + 1),
          false,
          index % 2 === 1 ? '#f6f6f6' : undefined,
        );
      });
    }

    // Follow-up expectation based on course length
    const maxDays = consultation.prescriptions?.length
      ? Math.max(...consultation.prescriptions.map((p) => p.durationInDays))
      : 0;
    doc.x = 48;
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fillColor('#111111').fontSize(12).text('Instructions');
    doc.moveDown(0.25);
    doc.font('Helvetica').fillColor('#333333').fontSize(10.5).text(
      maxDays > 0
        ? 'Follow the dosage and duration as prescribed. If there is no improvement after finishing the course, a follow-up review is recommended within ' + maxDays + ' day(s). Please review any aggravations or improvements at your next consultation.'
        : 'Follow the dosage as prescribed. Please review any aggravations or improvements at your next consultation.',
      { width: PAGE_W - 96 },
    );

    // Doctor signature block; spill onto a fresh page if needed.
    doc.x = 48;
    doc.moveDown(1.4);
    if (doc.y > 720) doc.addPage();
    doc.x = doc.page.width - 48 - 200;
    doc.font('Helvetica').fillColor('#444444').fontSize(11).text(
      `Dr. ${doctorDisplayName}`,
      { align: 'right', width: 200 },
    );
    if (qualifications) {
      doc.fontSize(9).fillColor('#666666').text(qualifications, { align: 'right', width: 200 });
    }
    doc.moveDown(0.4);
    doc.strokeColor('#333333').lineWidth(0.8);
    doc.moveTo(doc.page.width - 48 - 200, doc.y);
    doc.lineTo(doc.page.width - 48, doc.y);
    doc.stroke();
    doc.moveDown(0.2);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#444444').text('Signature', { align: 'right', width: 200 });
    doc.moveDown(0.1);
    doc.font('Helvetica').fontSize(8.5).fillColor('#555555').text('Licensed Homeopathic Practitioner', { align: 'right', width: 200 });

    drawFooter(doc, 'This is a machine-generated prescription.');
    doc.end();
  } catch (error) {
    if (!res.headersSent) {
      throw error;
    }
    res.end();
  }
};