import { Router } from "express";
import { getPublicClinicSettings } from "../controllers/clinic.controllers";

const router = Router();

// Public clinic card: name, address, phone, today's hours, cancellation
// policy. No auth — shown on Find Doctors before/without login.
router.get("/settings", getPublicClinicSettings);

export default router;