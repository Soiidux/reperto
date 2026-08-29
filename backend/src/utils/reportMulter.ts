import fs from "fs";
import path from "path";
import multer from "multer";
import { ApiError } from "../errors";

// Report vault accepts image scans and PDFs; larger than profile photos.
const ALLOWED_REPORT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const MAX_REPORT_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_REPORT_FILES = 5;

const TEMP_DIR = path.join(process.cwd(), "temp");
fs.mkdirSync(TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TEMP_DIR);
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

export const reportUpload = multer({
  storage,
  limits: {
    fileSize: MAX_REPORT_FILE_SIZE,
    files: MAX_REPORT_FILES,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_REPORT_TYPES.includes(file.mimetype)) {
      return cb(
        new ApiError(
          400,
          "Only JPEG, PNG, WebP images or PDF files are allowed",
        ),
      );
    }
    cb(null, true);
  },
});