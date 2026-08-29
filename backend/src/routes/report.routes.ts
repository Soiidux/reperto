import express from "express";
import {
  uploadReport,
  listReports,
  deleteReport,
} from "../controllers/report.controllers";
import { protect, authorize } from "../middlewares/auth.middlewares";
import { reportUpload } from "../utils/reportMulter";

const router = express.Router();

// Patients attach their own/family reports; staff/admin do front-desk intake.
// Doctors are deliberately excluded from upload and delete (view only).
router.post(
  "/",
  protect,
  authorize("patient", "staff", "admin"),
  reportUpload.array("files", 5),
  uploadReport,
);
router.get("/", protect, listReports);
router.delete("/:id", protect, authorize("patient", "staff", "admin"), deleteReport);

export default router;