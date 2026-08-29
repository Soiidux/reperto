import { Router } from "express";
import { upsertReview, deleteReview, listReviews } from "../controllers/review.controllers";
import { protect, authorize } from "../middlewares/auth.middlewares";
import { validate } from "../middlewares/validate";
import { reviewSchema } from "../zodSchemas";

const router = Router();

router.post("/", protect, authorize("patient"), validate(reviewSchema), upsertReview);
router.delete("/:doctorId", protect, authorize("patient"), deleteReview);
router.get("/", protect, listReviews);

export default router;