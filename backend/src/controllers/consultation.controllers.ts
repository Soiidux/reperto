import { Request, Response } from 'express';
import mongoose from 'mongoose';
import PDFDocument from 'pdfkit';
import Appointment from '../db/models/appointment.model';
import Consultation from '../db/models/consultation.model';
import User from '../db/models/user.model';
import { ApiError } from '../errors';

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
    patientId = req.user.id;
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
  
  const history = await Consultation.find({ patientId})
    .populate('doctorId', 'name profileImageUrl')
    .populate('patientId', 'name profileImageUrl')
    .populate(
      "appointmentId",
      "appointmentDate consultationType"
    )
    .sort({ createdAt: -1 });
  if(history.length === 0) {
    return res.status(404).json({ 
      success: false, 
      message: 'No completed consultations found for this patient.',
      data: null
    });
  }
  
  const response: ApiResponse<{ count: number; history: typeof history }> = {
    success: true,
    message: 'Patient history retrieved successfully',
    data: { count: history.length, history: history }
  };
  
  return res.status(200).json(response);

};

export const getLatestConsultation = async (req: Request, res: Response) => {
  const { patientId } = req.params;
  if (req.user.role === 'patient' && req.user.id !== patientId) {
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
  
  if(req.user.role === 'patient' && req.user.id !== patientId) {
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
      .populate('patientId', 'name profileImageUrl gender dateOfBirth')
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
    const isAuthorized =
      (role === 'patient' && consultation.patientId._id.toString() === req.user.id) ||
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

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="prescription-${(patient.name || 'patient').replace(/\s+/g, '-').toLowerCase()}.pdf"`,
    );

    doc.pipe(res);

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('PRESCRIPTION', { align: 'center' })
      .moveDown(0.5);

    doc.fontSize(10).font('Helvetica').fillColor('#444444').text('Reperto Homeopathic Clinic', { align: 'center' });
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

    doc.font('Helvetica').fillColor('#111111').fontSize(11);
    doc.text(`Patient Name: ${patient.name || '-'}`, { continued: false });
    doc.text(`Date: ${date}`);
    doc.moveDown(0.25);
    doc.text(`Doctor: ${doctor.name || ''}${doctor.doctorProfile?.qualifications?.length ? `, ${doctor.doctorProfile.qualifications.join(', ')}` : ''}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fontSize(12).text('Diagnosis');
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(11).text(consultation.diagnosis || '-');
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fontSize(12).text('Prescribed Remedies');
    doc.moveDown(0.35);

    const columnX = doc.x;
    const columnWidths = [150, 90, 170, 90];
    const tableLeft = columnX;
    const headerY = doc.y;

    const drawRow = (cols: string[], y: number, bold = false) => {
      let x = tableLeft;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10.5);
      cols.forEach((cell, i) => {
        doc.text(cell, x, y, { width: columnWidths[i], lineBreak: false });
        x += columnWidths[i];
      });
      doc.moveDown(0.6);
    };

    drawRow(['Remedy', 'Potency', 'Dosage', 'Duration'], headerY, true);

    if (!consultation.prescriptions || consultation.prescriptions.length === 0) {
      doc.font('Helvetica').fontSize(10.5).text('No remedies prescribed.', tableLeft, doc.y);
    } else {
      consultation.prescriptions.forEach((p) => {
        drawRow(
          [p.remedyName, p.potency || '-', p.dosage, `${p.durationInDays} day(s)`],
          doc.y,
        );
      });
    }

    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').fontSize(12).text('Instructions');
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(10.5).text(
      'Follow the dosage and duration as prescribed. Please review any aggravations or improvements at your next consultation.',
    );

    doc.moveDown(2);
    doc.fontSize(10).fillColor('#666666').text('This is a machine-generated prescription from Reperto.', { align: 'center' });

    doc.end();
  } catch (error) {
    if (!res.headersSent) {
      throw error;
    }
    res.end();
  }
};