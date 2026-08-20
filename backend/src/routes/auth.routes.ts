import { Router } from "express";
import { loginUser, registerUser , refreshAccessToken, logoutUser, updateEmail, updatePhone, updatePassword } from "../controllers/auth.controllers";
import { protect } from "../middlewares/auth.middlewares";
import { upload } from "../utils/multer";
const router = Router();

router.post("/register", upload.single("profileImage"), registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logoutUser);
router.patch("/email", protect, updateEmail);
router.patch("/phone", protect, updatePhone);
router.patch("/password", protect, updatePassword);
export default router;
