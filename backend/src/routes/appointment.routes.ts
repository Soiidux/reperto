import express from 'express';
import { bookAppointment, getActiveAppointments, getAppointment, getAppointments, getTodaysAppointments, updateAppointmentStatus, rescheduleAppointment, getAvailableSlots, getArrivedPatients, getSlotStates } from '../controllers/appointment.controllers';
import { createHold, bookFromHold, releaseHold } from '../controllers/hold.controllers';
import { getAppointmentTicketQr, checkInByTicket } from '../controllers/ticket.controllers';
import { protect, authorize } from '../middlewares/auth.middlewares';
import { validate } from '../middlewares/validate';
import { bookingSchema, updateAppointmentStatusSchema, rescheduleSchema, holdSchema, bookFromHoldSchema, checkInTicketSchema } from '../zodSchemas';
import { bookingLimiter, checkInLimiter } from '../middlewares/rateLimiters';

const router = express.Router();

// Patients book for themselves; staff/admin book on behalf of walk-ins
router.post('/', bookingLimiter, protect, authorize('patient', 'staff', 'admin'), validate(bookingSchema), bookAppointment);
router.get('/', protect, getAppointments);

// Movie-style booking: reserve a time chip, then convert it to a real booking.
// Patients only — staff/admin keep the direct form below.
router.post('/hold', bookingLimiter, protect, authorize('patient'), validate(holdSchema), createHold);
router.post('/hold/:id/book', bookingLimiter, protect, authorize('patient'), validate(bookFromHoldSchema), bookFromHold);
router.delete('/hold/:id', bookingLimiter, protect, authorize('patient'), releaseHold);

// Live slot states (free / held-by-me / held / taken) for the booking screen.
// Registered before /:id so the static segment isn't treated as an id.
router.get('/slots', protect, getSlotStates);

router.get('/active', protect, getActiveAppointments);
router.get('/arrived', protect, getArrivedPatients);
router.get('/today', protect, getTodaysAppointments);
router.get('/available-slots', protect, getAvailableSlots);

// Reception check-in from the e-ticket QR: scan or type the code. Front-desk
// only (staff/admin). Registered before /:id so the static segment never reads
// as an appointment id.
router.post('/check-in', checkInLimiter, protect, authorize('staff', 'admin'), validate(checkInTicketSchema), checkInByTicket);

router.get('/:id', protect, getAppointment);
router.patch('/:id/status', bookingLimiter, protect, validate(updateAppointmentStatusSchema), updateAppointmentStatus);
router.patch('/:id/reschedule', bookingLimiter, protect, validate(rescheduleSchema), rescheduleAppointment);
router.get('/:id/ticket/qr', protect, getAppointmentTicketQr);
export default router;