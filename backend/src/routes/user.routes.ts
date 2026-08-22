import { Router } from "express";
import { getMe, getDoctors, getPatients, updateProfileImage } from "../controllers/user.controllers";
import { protect, authorize } from "../middlewares/auth.middlewares";
import { upload } from "../utils/multer";

const router = Router();

router.get("/me", protect, getMe);
// Field name must stay "profileImage" to match the register endpoint's multer setup
router.patch("/me/profile-image", protect, upload.single("profileImage"), updateProfileImage);
router.get("/doctors", getDoctors);
router.get("/patients", protect, authorize("doctor", "staff", "admin"), getPatients);
export default router;