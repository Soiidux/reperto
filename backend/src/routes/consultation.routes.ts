import express from 'express';
import {
  createConsultation,
  getPatientHistory,
  getLatestConsultation,
  getConsultation,
  getFollowUps,
  setFollowUpStatus,
} from '../controllers/consultation.controllers';
import { protect, requirePermission } from '../middlewares/auth.middlewares';
import { type ValidateOptions, validate } from '../middlewares/validate';
import { consultationSchema } from '../zodSchemas';

import { consultationsQuerySchema, followUpsQuerySchema } from '../zodQuerySchemas';

/**
 * Named so the intent reads at the call site: this validates the query
 * string, not the body. See zodQuerySchemas.ts for why these exist and
 * how they are shaped to stay behaviour-compatible.
 */
const QUERY: ValidateOptions = { source: 'query' };

const router = express.Router();

// Only Doctors can create consultations
router.post('/', protect, requirePermission("consultations:create"), validate(consultationSchema), createConsultation);

// Doctors can see any history; Patients can see their own (handled in controller)
router.get('/history/:patientId', protect, requirePermission("consultations:read"), getPatientHistory);

router.get('/', protect, requirePermission("consultations:read"), validate(consultationsQuerySchema, QUERY), getConsultation);
// Quick access to the last record for follow-ups
router.get('/latest/:patientId', protect, requirePermission("consultations:read"), getLatestConsultation);

// Follow-up tracker: doctors see upcoming/overdue follow-ups and can mark them
router.get('/follow-ups', protect, requirePermission("consultations:manage-follow-up"), validate(followUpsQuerySchema, QUERY), getFollowUps);
router.patch('/:id/follow-up', protect, requirePermission("consultations:manage-follow-up"), setFollowUpStatus);

export default router;