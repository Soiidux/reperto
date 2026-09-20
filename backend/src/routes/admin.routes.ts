import { Router } from "express";
import {
  createTeamMember,
  exportAppointmentsCsv,
  exportPatientsCsv,
  getAllUsers,
  toggleUserActive,
  getStats,
  getAnalytics,
  updateClinicSettings,
  getClinicBlockouts,
  saveClinicBlockout,
  deleteClinicBlockout,
} from "../controllers/admin.controllers";
import { protect, authorize } from "../middlewares/auth.middlewares";
import { validate } from "../middlewares/validate";
import {
  createTeamMemberSchema,
  clinicSettingsSchema,
  clinicBlockoutSchema,
} from "../zodSchemas";

const router = Router();

router.use(protect, authorize("admin"));

router.get("/stats", getStats);
router.get("/analytics", getAnalytics);
router.get("/users", getAllUsers);
router.patch("/users/:id/activate", toggleUserActive);
router.post("/team", validate(createTeamMemberSchema), createTeamMember);
router.get("/export/appointments", exportAppointmentsCsv);
router.get("/export/patients", exportPatientsCsv);

// Clinic settings (page shown to patients) + one-off date blockouts
router.put("/clinic-settings", validate(clinicSettingsSchema), updateClinicSettings);
router.get("/clinic-blockouts", getClinicBlockouts);
router.post("/clinic-blockouts", validate(clinicBlockoutSchema), saveClinicBlockout);
router.delete("/clinic-blockouts/:date", deleteClinicBlockout);

export default router;