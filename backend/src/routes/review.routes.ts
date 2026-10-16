import { Router } from "express";
import { upsertReview, deleteReview, listReviews } from "../controllers/review.controllers";
import { protect, requirePermission } from "../middlewares/auth.middlewares";
import { type ValidateOptions, validate } from '../middlewares/validate';
import { reviewSchema } from "../zodSchemas";

import { reviewsQuerySchema } from '../zodQuerySchemas';

/**
 * Named so the intent reads at the call site: this validates the query
 * string, not the body. See zodQuerySchemas.ts for why these exist and
 * how they are shaped to stay behaviour-compatible.
 */
const QUERY: ValidateOptions = { source: 'query' };

const router = Router();

router.post("/", protect, requirePermission("reviews:write"), validate(reviewSchema), upsertReview);
router.delete("/:doctorId", protect, requirePermission("reviews:delete"), deleteReview);
router.get("/", protect, requirePermission("reviews:read"), validate(reviewsQuerySchema, QUERY), listReviews);

export default router;