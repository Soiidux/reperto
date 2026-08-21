import express from 'express';
import { bookAppointment, getActiveAppointments, getAppointment, getAppointments, getTodaysAppointments, updateAppointmentStatus, getAvailableSlots, getArrivedPatients } from '../controllers/appointment.controllers';
import { protect, authorize } from '../middlewares/auth.middlewares';
import { validate } from '../middlewares/validate';
import { bookingSchema, updateAppointmentStatusSchema } from '../zodSchemas';
import { bookingLimiter } from '../middlewares/rateLimiters';

const router = express.Router();

// Patients book for themselves; staff/admin book on behalf of walk-ins
router.post('/', bookingLimiter, protect, authorize('patient', 'staff', 'admin'), validate(bookingSchema), bookAppointment);
router.get('/', protect, getAppointments);
router.get('/active', protect, getActiveAppointments);
router.get('/arrived', protect, getArrivedPatients);
router.get('/today', protect, getTodaysAppointments);
router.get('/available-slots', protect, getAvailableSlots);
router.get('/:id', protect, getAppointment);
router.patch('/:id/status', bookingLimiter, protect, validate(updateAppointmentStatusSchema), updateAppointmentStatus);
export default router;