import express from 'express';
import { bookAppointment, getActiveAppointments, getAppointment, getAppointments, getTodaysAppointments, updateAppointmentStatus, rescheduleAppointment, getAvailableSlots, getArrivedPatients, getSlotStates } from '../controllers/appointment.controllers';
import { createHold, bookFromHold, releaseHold } from '../controllers/hold.controllers';
import { getAppointmentTicketQr, checkInByTicket } from '../controllers/ticket.controllers';
import { protect, requirePermission } from '../middlewares/auth.middlewares';
import { validate } from '../middlewares/validate';
import { bookingSchema, updateAppointmentStatusSchema, rescheduleSchema, holdSchema, bookFromHoldSchema, checkInTicketSchema } from '../zodSchemas';
import { bookingLimiter, checkInLimiter, statusLimiter } from '../middlewares/rateLimiters';

const router = express.Router();

// Patients book for themselves; staff/admin book on behalf of walk-ins
router.post('/', bookingLimiter, protect, requirePermission("appointments:book"), validate(bookingSchema), bookAppointment);
router.get('/', protect, requirePermission("appointments:read"), getAppointments);

// Movie-style booking: reserve a time chip, then convert it to a real booking.
// Patients only — staff/admin keep the direct form below.
router.post('/hold', bookingLimiter, protect, requirePermission("appointments:hold"), validate(holdSchema), createHold);
router.post('/hold/:id/book', bookingLimiter, protect, requirePermission("appointments:hold"), validate(bookFromHoldSchema), bookFromHold);
router.delete('/hold/:id', bookingLimiter, protect, requirePermission("appointments:hold"), releaseHold);

// Live slot states (free / held-by-me / held / taken) for the booking screen.
// Registered before /:id so the static segment isn't treated as an id.
router.get('/slots', protect, requirePermission("appointments:read"), getSlotStates);

router.get('/active', protect, requirePermission("appointments:read"), getActiveAppointments);
router.get('/arrived', protect, requirePermission("appointments:read"), getArrivedPatients);
router.get('/today', protect, requirePermission("appointments:read"), getTodaysAppointments);
router.get('/available-slots', protect, requirePermission("appointments:read"), getAvailableSlots);

// Reception check-in from the e-ticket QR: scan or type the code. Front-desk
// only (staff/admin). Registered before /:id so the static segment never reads
// as an appointment id.
router.post('/check-in', checkInLimiter, protect, requirePermission("appointments:check-in"), validate(checkInTicketSchema), checkInByTicket);

router.get('/:id', protect, requirePermission("appointments:read"), getAppointment);
router.patch(
  '/:id/status',
  statusLimiter,
  protect,
  requirePermission("appointments:edit-status"),
  validate(updateAppointmentStatusSchema),
  updateAppointmentStatus,
);
router.patch(
  '/:id/reschedule',
  bookingLimiter,
  protect,
  requirePermission("appointments:reschedule"),
  validate(rescheduleSchema),
  rescheduleAppointment,
);
router.get('/:id/ticket/qr', protect, requirePermission("appointments:read"), getAppointmentTicketQr);
export default router;