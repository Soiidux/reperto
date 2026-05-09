import multer from "multer";

//Store files in temp
const storage = multer.diskStorage({
  destination: (req, res, cb) => {
    cb(null, './temp');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

export const upload = multer({ storage });