import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Appointment from '../db/models/appointment.model';
import Consultation from '../db/models/consultation.model';
import User from '../db/models/user.model';
import { ApiError } from '../errors';
import { canActForPatient } from '../utils/patientScope';
import { computeFollowUpDate } from '../utils/followUps';
import { recordAccess } from '../db/models/accessLog.model';

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
  
  // Follow-up timeline: the course ends after the longest prescription.
  const followUpDate = computeFollowUpDate(prescriptions, new Date());

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
    doctorNotes,
    followUpDate,
    followUpStatus: followUpDate ? 'pending' : 'skipped',
  });
  
  await consultation.save().catch((error: any) => {
    if (error?.code === 11000) {
      throw new ApiError(409, "Consultation already exists");
    }
    throw error;
  });
  appointment.status = 'completed';
  await appointment.save();

  // A new consultation after a previous course has run its course resolves
  // the earlier follow-up automatically (patient is back in review).
  if (followUpDate) {
    await Consultation.updateMany(
      {
        patientId: appointment.patientId,
        _id: { $ne: consultation._id },
        followUpDate: { $lt: new Date() },
        followUpStatus: { $in: ['pending', 'overdue'] },
      },
      { followUpStatus: 'done' },
    ).catch((error) => {
      console.error('Failed to auto-resolve previous follow-ups:', error);
    });
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

  // The medical-history view is the broadest read of a patient's record
  // (every consultation with diagnoses and prescriptions), so it is audited.
  await recordAccess({
    actorId: req.user.id,
    actorRole: req.user.role,
    patientId: String(patientId),
    resource: 'medical-history',
    action: 'read',
    route: 'GET /api/consultation/history/:patientId',
    ip: req.ip,
  });

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

  // Reading a consultation means reading the patient's diagnosis and
  // prescriptions: log it. Awaited so the entry exists before we respond.
  await recordAccess({
    actorId: req.user.id,
    actorRole: req.user.role,
    patientId: String(patientId),
    resource: 'consultation',
    resourceId: consultation._id.toString(),
    action: 'read',
    route: 'GET /api/consultation',
    ip: req.ip,
  });
  
  const response: ApiResponse<typeof consultation> = {
    success: true,
    message: 'Consultation retrieved successfully',
    data: consultation
  };
  res.status(200).json(response);
};

// Follow-up tracker ---------------------------------------------------------

// Range (in days) over which a doctor wants to see pending/overdue follow-ups
// ahead of time, so they can prepare for the week.
const FOLLOW_UP_LOOKAHEAD_DAYS = 14;

export const getFollowUps = async (req: Request, res: Response) => {
  const role = req.user.role;
  const today = new Date();
  const horizon = new Date(today.getTime() + FOLLOW_UP_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  const query: Record<string, any> = {
    followUpDate: { $ne: null },
    // Normalise just-in-time so legacy rows (pre-backfill) still surface.
    $or: [
      { followUpStatus: { $in: ['pending', 'overdue'] } },
      { followUpDate: { $lte: horizon }, followUpStatus: { $nin: ['done', 'skipped'] } },
    ],
  };
  if (role === 'doctor') {
    query.doctorId = req.user.id;
  }

  const consultations = await Consultation.find(query)
    .populate('patientId', 'name gender dateOfBirth profileImageUrl')
    .populate('doctorId', 'name')
    .select('patientId doctorId diagnosis followUpDate followUpStatus appointmentId createdAt')
    .sort({ followUpDate: 1 })
    .lean();

  res.status(200).json({
    success: true,
    message: 'Follow-ups retrieved successfully',
    data: consultations,
  });
};

const FOLLOW_UP_TRANSITIONS: Record<string, string> = {
  done: 'done',
  skipped: 'skipped',
};

export const setFollowUpStatus = async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!Object.prototype.hasOwnProperty.call(FOLLOW_UP_TRANSITIONS, status)) {
    throw new ApiError(400, 'Invalid follow-up status. Expected "done", "skipped" or "restored".');
  }

  const consultation = await Consultation.findById(req.params.id)
    .select('doctorId followUpDate followUpStatus')
    .lean();
  if (!consultation) {
    return res.status(404).json({
      success: false,
      message: 'Consultation record not found',
      data: null,
    });
  }

  const role = req.user.role;
  const isDoctorOwner = role === 'doctor' && consultation.doctorId.toString() === req.user.id;
  if (!isDoctorOwner && role !== 'admin' && role !== 'staff') {
    return res.status(403).json(unauthorizedResponse);
  }

  const target =
    status === 'restored'
      ? (consultation.followUpDate
          ? (consultation.followUpDate.getTime() < Date.now() ? 'overdue' : 'pending')
          : 'skipped')
      : FOLLOW_UP_TRANSITIONS[status];

  await Consultation.updateOne({ _id: consultation._id }, { followUpStatus: target });

  const response: ApiResponse<object> = {
    success: true,
    message: 'Follow-up status updated',
    data: { _id: consultation._id, followUpStatus: target },
  };
  res.status(200).json(response);
};

