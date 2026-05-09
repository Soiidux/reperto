import { Router } from "express";
import { loginUser, registerUser , refreshAccessToken, logoutUser } from "../controllers/auth.controllers";
import { upload } from "../utils/multer";
const router = Router();

router.post("/register", upload.single("profileImage"), registerUser);
router.post("/login", loginUser);
router.post("/refresh", refreshAccessToken);
router.post("/logout", logoutUser);
export default router;
