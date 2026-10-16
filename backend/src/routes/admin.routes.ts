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
import {
  getPatientAccessLog,
  getAccessActivity,
  getPatientAccessByStaff,
} from "../controllers/accessLog.controllers";
import { protect, requirePermission } from "../middlewares/auth.middlewares";
import { type ValidateOptions, validate } from '../middlewares/validate';
import {
  createTeamMemberSchema,
  clinicSettingsSchema,
  clinicBlockoutSchema,
} from "../zodSchemas";

import { adminUsersQuerySchema, auditActivityQuerySchema, auditPatientQuerySchema, clinicBlockoutsQuerySchema, exportAppointmentsQuerySchema } from '../zodQuerySchemas';

/**
 * Named so the intent reads at the call site: this validates the query
 * string, not the body. See zodQuerySchemas.ts for why these exist and
 * how they are shaped to stay behaviour-compatible.
 */
const QUERY: ValidateOptions = { source: 'query' };

const router = Router();

router.use(protect, requirePermission("admin:manage"));

router.get("/stats", getStats);
router.get("/analytics", getAnalytics);
router.get("/users", validate(adminUsersQuerySchema, QUERY), getAllUsers);
router.patch("/users/:id/activate", toggleUserActive);
router.post("/team", validate(createTeamMemberSchema), createTeamMember);
router.get("/export/appointments", validate(exportAppointmentsQuerySchema, QUERY), exportAppointmentsCsv);
router.get("/export/patients", exportPatientsCsv);

// Access audit trail — who read a patient's protected health information.
// Registered under the same admin-only guard as the rest of this router.
router.get("/audit/activity", requirePermission("audit:read"), validate(auditActivityQuerySchema, QUERY), getAccessActivity);
router.get("/audit/patient/:patientId", requirePermission("audit:read"), validate(auditPatientQuerySchema, QUERY), getPatientAccessLog);
router.get(
  "/audit/patient/:patientId/by-staff",
  requirePermission("audit:read"),
  getPatientAccessByStaff,
);

// Clinic settings (page shown to patients) + one-off date blockouts
router.put("/clinic-settings", validate(clinicSettingsSchema), updateClinicSettings);
router.get("/clinic-blockouts", validate(clinicBlockoutsQuerySchema, QUERY), getClinicBlockouts);
router.post("/clinic-blockouts", validate(clinicBlockoutSchema), saveClinicBlockout);
router.delete("/clinic-blockouts/:date", deleteClinicBlockout);

export default router;