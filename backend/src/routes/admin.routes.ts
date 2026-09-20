import { Router } from "express";
import {
  createTeamMember,
  exportAppointmentsCsv,
  exportPatientsCsv,
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
router.get("/export/appointments", exportAppointmentsCsv);
router.get("/export/patients", exportPatientsCsv);

export default router;