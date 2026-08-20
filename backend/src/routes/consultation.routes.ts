import express from 'express';
import { 
  createConsultation, 
  getPatientHistory, 
  getLatestConsultation,
  getConsultation,
  getPrescription,
} from '../controllers/consultation.controllers';
import { protect, authorize } from '../middlewares/auth.middlewares';
import { validate } from '../middlewares/validate';
import { consultationSchema } from '../zodSchemas';

const router = express.Router();

// Only Doctors can create consultations
router.post('/', protect, authorize('doctor'), validate(consultationSchema), createConsultation);

// Doctors can see any history; Patients can see their own (handled in controller)
router.get('/history/:patientId', protect, getPatientHistory);

router.get('/', protect, getConsultation);
// Quick access to the last record for follow-ups
router.get('/latest/:patientId', protect, getLatestConsultation);

// E-prescription PDF (patient downloads their own)
router.get('/:id/prescription', protect, getPrescription);

export default router;