import { Router } from "express";
import { getMe } from "../controllers/user.controllers";
import { protect, authorize } from "../middlewares/auth.middlewares";

const router = Router();

router.get("/me", protect, getMe);
router.get("/doctor-test", protect, authorize("doctor"), (req, res) => {
  res.json({ message: "Welcome, Doctor!" });
});

export default router;