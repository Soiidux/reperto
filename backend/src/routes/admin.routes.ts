import { Router } from "express";
import { getAllUsers, toggleUserActive, getStats, getAnalytics } from "../controllers/admin.controllers";
import { protect, authorize } from "../middlewares/auth.middlewares";

const router = Router();

router.use(protect, authorize("admin"));

router.get("/stats", getStats);
router.get("/analytics", getAnalytics);
router.get("/users", getAllUsers);
router.patch("/users/:id/activate", toggleUserActive);

export default router;