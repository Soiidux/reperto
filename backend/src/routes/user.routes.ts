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
  addByShareCode,
  getMyShareCode,
  exportMyData,
} from "../controllers/user.controllers";
import { protect, authorize } from "../middlewares/auth.middlewares";
import { upload } from "../utils/multer";

const router = Router();

router.get("/me", protect, getMe);
// GDPR-style export of everything the account can view.
router.get("/me/export", protect, exportMyData);
// Field name must stay "profileImage" to match the register endpoint's multer setup
router.patch("/me/profile-image", protect, upload.single("profileImage"), updateProfileImage);

// Family accounts. Guardians manage; dependents never log in, and real
// accounts can be linked into a family space by their own code.
router.post(
  "/me/family",
  protect,
  upload.single("profileImage"),
  createFamilyMember,
);
router.get("/me/family", protect, listFamilyMembers);
router.patch("/me/family/:id", protect, updateFamilyMember);
router.delete("/me/family/:id", protect, removeFamilyMember);
router.post("/me/family/add-by-code", protect, addByShareCode);
router.post("/me/family/:id/share-code", protect, regenerateShareCode);
// The user's own family code (generated on first view for older accounts).
router.get("/me/share-code", protect, getMyShareCode);
// Guardian management: creator strips others; anyone may leave themselves
router.delete("/me/family/:id/guardians/:guardianId", protect, removeGuardian);
router.post("/me/family/:id/leave", protect, leaveFamilyMember);

router.get("/doctors", getDoctors);
router.get("/patients", protect, authorize("doctor", "staff", "admin"), getPatients);
export default router;