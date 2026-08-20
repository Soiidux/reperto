import { Router } from "express";
import { getMe, getDoctors, getPatients } from "../controllers/user.controllers";
import { protect, authorize } from "../middlewares/auth.middlewares";

const router = Router();

router.get("/me", protect, getMe);
router.get("/doctors", getDoctors);
router.get("/patients", protect, authorize("doctor"), getPatients);
export default router;