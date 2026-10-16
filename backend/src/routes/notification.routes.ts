import { Router } from "express";
import { protect } from "../middlewares/auth.middlewares";
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "../controllers/notification.controllers";

import { type ValidateOptions, validate } from '../middlewares/validate';
import { notificationsQuerySchema } from '../zodQuerySchemas';

/**
 * Named so the intent reads at the call site: this validates the query
 * string, not the body. See zodQuerySchemas.ts for why these exist and
 * how they are shaped to stay behaviour-compatible.
 */
const QUERY: ValidateOptions = { source: 'query' };

const router = Router();

router.get("/", protect, validate(notificationsQuerySchema, QUERY), getNotifications);
router.get("/unread-count", protect, getUnreadCount);
router.patch("/read-all", protect, markAllNotificationsRead);
router.patch("/:id/read", protect, markNotificationRead);

export default router;