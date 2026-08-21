import { Router } from "express";
import { loginUser, registerUser , refreshAccessToken, logoutUser, updateEmail, updatePhone, updatePassword } from "../controllers/auth.controllers";
import { protect } from "../middlewares/auth.middlewares";
import { validate } from "../middlewares/validate";
import { registerSchema, loginSchema } from "../zodSchemas";
import { upload } from "../utils/multer";
import { authLimiter, refreshLimiter } from "../middlewares/rateLimiters";
const router = Router();

router.post("/register", authLimiter, upload.single("profileImage"), validate(registerSchema), registerUser);
router.post("/login", authLimiter, validate(loginSchema), loginUser);
router.post("/refresh", refreshLimiter, refreshAccessToken);
router.post("/logout", logoutUser);
router.patch("/email", protect, updateEmail);
router.patch("/phone", protect, updatePhone);
router.patch("/password", protect, updatePassword);
export default router;
