import { Router } from 'express';
import { addLeave, removeLeave } from '../controllers/leave.controllers';
import { protect, authorize } from '../middlewares/auth.middlewares';

const router = Router();

router.post('/add', protect, authorize('doctor'), addLeave);
router.delete('/remove/:leaveId', protect, authorize('doctor'), removeLeave);

export default router;