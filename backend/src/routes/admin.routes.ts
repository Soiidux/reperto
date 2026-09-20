import { Router } from "express";
import {
  createTeamMember,
  getAllUsers,
  toggleUserActive,
  getStats,
  getAnalytics,
} from "../controllers/admin.controllers";
import { protect, authorize } from "../middlewares/auth.middlewares";
import { validate } from "../middlewares/validate";
import { createTeamMemberSchema } from "../zodSchemas";

const router = Router();

router.use(protect, authorize("admin"));

router.get("/stats", getStats);
router.get("/analytics", getAnalytics);
router.get("/users", getAllUsers);
router.patch("/users/:id/activate", toggleUserActive);
router.post("/team", validate(createTeamMemberSchema), createTeamMember);

export default router;