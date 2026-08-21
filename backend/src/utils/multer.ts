import multer from "multer";
import { ApiError } from "../errors";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

//Store files in temp
const storage = multer.diskStorage({
  destination: (req, res, cb) => {
    cb(null, './temp');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(400, "Only JPEG, PNG, or WebP images are allowed"));
    }
    cb(null, true);
  },
});
