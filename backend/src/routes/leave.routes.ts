import { Router } from 'express';
import { addLeave, getLeaves, removeLeave } from '../controllers/leave.controllers';
import { protect, authorize } from '../middlewares/auth.middlewares';
import { validate } from '../middlewares/validate';
import { addLeaveSchema } from '../zodSchemas';

const router = Router();

router.post('/add', protect, authorize('doctor'), validate(addLeaveSchema), addLeave);
router.get('/my', protect, authorize('doctor'), getLeaves);
router.delete('/remove/:leaveId', protect, authorize('doctor'), removeLeave);

export default router;