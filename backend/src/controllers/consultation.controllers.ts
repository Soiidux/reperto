import { Request, Response } from 'express';
import Appointment from '../db/models/appointment.model';
import Consultation from '../db/models/consultation.model';

export const createConsultation = async (req: Request, res: Response) => {
  try {
    const {
      appointmentId,
      cheifComplaintDetails,
      pastMedicalHistory,
      physicalGenerals,
      mentalGenerals,
      diagnosis,
      prescriptions,
      doctorNotes
    } = req.body;
    
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    if (appointment.doctorId.toString() !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to consult for this appointment" });
    }
    
    const existingConsultation = await Consultation.findOne({ appointmentId });
    
    if (existingConsultation) {
      return res.status(400).json({ message: 'Consultation already exists' });
    }
    
    const consultation = new Consultation({
      appointmentId,
      patientId: appointment.patientId,
      doctorId: req.user.id,
      cheifComplaintDetails,
      pastMedicalHistory,
      physicalGenerals,
      mentalGenerals,
      diagnosis,
      prescriptions,
      doctorNotes
    });
    
    await consultation.save();
    appointment.status = 'completed';
    await appointment.save();
    
    return res.status(201).json({
      success: true,
      message: 'Consultation created successfully',
      data: consultation
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: (error as Error).message
    });
  }
};

export const getPatientHistory = async (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;
    if(req.user.role === 'patient' && req.user.id !== patientId) {
      return res.status(403).json({ message: 'You are not authorized to view this patient history' });
    }
    
    const history = await Consultation.find({ patientId })
      .populate('doctorId', 'name')
      .sort({ createdAt: -1 });
    
    return res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: (error as Error).message
    });
  }
};

export const getLatestConsultation = async (req: any, res: Response) => {
  try {
    const { patientId } = req.params;
    const latest = await Consultation.findOne({ patientId })
      .populate('doctorId', 'name')
      .sort({ createdAt: -1 })
      .limit(1);

    res.status(200).json({ success: true, data: latest });
  } catch (error: any) {
    res.status(500).json({ message: "Error", error: error.message });
  }
};