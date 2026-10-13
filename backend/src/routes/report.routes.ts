import express from "express";
import {
  uploadReport,
  listReports,
  deleteReport,
  getReportFile,
} from "../controllers/report.controllers";
import { protect, requirePermission } from "../middlewares/auth.middlewares";
import { reportUpload } from "../utils/reportMulter";

const router = express.Router();

// Patients attach their own/family reports; staff/admin do front-desk intake.
// Doctors are deliberately excluded from upload and delete (view only).
router.post(
  "/",
  protect,
  requirePermission("reports:upload"),
  reportUpload.array("files", 5),
  uploadReport,
);
router.get("/", protect, listReports);
// Streams/redirects a single file. Registered before "/:id" so the static
// segment isn't read as a report id.
router.get("/:id/file/:index", protect, getReportFile);
router.delete("/:id", protect, requirePermission("reports:delete"), deleteReport);

export default router;