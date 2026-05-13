import express from 'express';
import { bookAppointment ,getAppointments, getTodaysAppointments, updateAppointmentStatus, getAvailableSlots} from '../controllers/appointment.controllers';
import { protect, authorize } from '../middlewares/auth.middlewares';

const router = express.Router();

// Only patients should be able to book
router.post('/', protect, authorize('patient'), bookAppointment);
router.get('/my', protect, getAppointments);
router.get('/today', protect, getTodaysAppointments);
router.patch('/:id/status', protect, updateAppointmentStatus);
router.get('/available-slots', protect, getAvailableSlots);
export default router;