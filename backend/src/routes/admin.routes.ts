import { Router } from "express";
import { getAllUsers, toggleUserActive, getStats } from "../controllers/admin.controllers";
import { protect, authorize } from "../middlewares/auth.middlewares";

const router = Router();

router.use(protect, authorize("admin"));

router.get("/stats", getStats);
router.get("/users", getAllUsers);
router.patch("/users/:id/activate", toggleUserActive);

export default router;