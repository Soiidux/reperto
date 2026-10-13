import { Router } from 'express';
import { addLeave, getLeaves, removeLeave } from '../controllers/leave.controllers';
import { protect, requirePermission } from '../middlewares/auth.middlewares';
import { validate } from '../middlewares/validate';
import { addLeaveSchema } from '../zodSchemas';

const router = Router();

router.post('/add', protect, requirePermission("leave:manage"), validate(addLeaveSchema), addLeave);
router.get('/my', protect, requirePermission("leave:manage"), getLeaves);
router.delete('/remove/:leaveId', protect, requirePermission("leave:manage"), removeLeave);

export default router;