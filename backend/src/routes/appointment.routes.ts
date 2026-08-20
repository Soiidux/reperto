import express from 'express';
import { bookAppointment, getActiveAppointments, getAppointment, getAppointments, getTodaysAppointments, updateAppointmentStatus, getAvailableSlots, getArrivedPatients } from '../controllers/appointment.controllers';
import { protect, authorize } from '../middlewares/auth.middlewares';

const router = express.Router();

// Only patients should be able to book
router.post('/', protect, authorize('patient'), bookAppointment);
router.get('/', protect, getAppointments);
router.get('/active', protect, getActiveAppointments);
router.get('/arrived', protect, getArrivedPatients);
router.get('/today', protect, getTodaysAppointments);
router.get('/available-slots', protect, getAvailableSlots);
router.get('/:id', protect, getAppointment);
router.patch('/:id/status', protect, updateAppointmentStatus);
export default router;