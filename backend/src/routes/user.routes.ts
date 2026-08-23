import { Router } from "express";
import {
  getMe,
  getDoctors,
  getPatients,
  updateProfileImage,
  createFamilyMember,
  listFamilyMembers,
  updateFamilyMember,
  removeFamilyMember,
  removeGuardian,
  leaveFamilyMember,
  regenerateShareCode,
  joinByShareCode,
} from "../controllers/user.controllers";
import { protect, authorize } from "../middlewares/auth.middlewares";
import { upload } from "../utils/multer";

const router = Router();

router.get("/me", protect, getMe);
// Field name must stay "profileImage" to match the register endpoint's multer setup
router.patch("/me/profile-image", protect, upload.single("profileImage"), updateProfileImage);

// Family accounts (dependents). Guardians manage; dependents never log in.
router.post(
  "/me/family",
  protect,
  upload.single("profileImage"),
  createFamilyMember,
);
router.get("/me/family", protect, listFamilyMembers);
router.patch("/me/family/:id", protect, updateFamilyMember);
router.delete("/me/family/:id", protect, removeFamilyMember);
router.post("/me/family/join", protect, joinByShareCode);
router.post("/me/family/:id/share-code", protect, regenerateShareCode);
// Guardian management: creator strips others; anyone may leave themselves
router.delete("/me/family/:id/guardians/:guardianId", protect, removeGuardian);
router.post("/me/family/:id/leave", protect, leaveFamilyMember);

router.get("/doctors", getDoctors);
router.get("/patients", protect, authorize("doctor", "staff", "admin"), getPatients);
export default router;