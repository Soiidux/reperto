import { Router } from "express";
import { loginUser, registerUser } from "../controllers/user.controllers";
import { upload } from "../utils/multer";
const router = Router();

router.post("/register", upload.single("profileImage"), registerUser);
router.post("/login", loginUser);

export default router;
