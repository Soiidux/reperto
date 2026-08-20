import express from 'express';
import { 
  createConsultation, 
  getPatientHistory, 
  getLatestConsultation,
  getConsultation,
} from '../controllers/consultation.controllers';
import { protect, authorize } from '../middlewares/auth.middlewares';

const router = express.Router();

// Only Doctors can create consultations
router.post('/', protect, authorize('doctor'), createConsultation);

// Doctors can see any history; Patients can see their own (handled in controller)
router.get('/history/:patientId', protect, getPatientHistory);

router.get('/', protect, getConsultation);
// Quick access to the last record for follow-ups
router.get('/latest/:patientId', protect, getLatestConsultation);

export default router;