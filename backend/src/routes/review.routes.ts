import { Router } from "express";
import { upsertReview, deleteReview, listReviews } from "../controllers/review.controllers";
import { protect, requirePermission } from "../middlewares/auth.middlewares";
import { validate } from "../middlewares/validate";
import { reviewSchema } from "../zodSchemas";

const router = Router();

router.post("/", protect, requirePermission("reviews:write"), validate(reviewSchema), upsertReview);
router.delete("/:doctorId", protect, requirePermission("reviews:delete"), deleteReview);
router.get("/", protect, requirePermission("reviews:read"), listReviews);

export default router;