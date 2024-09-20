import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

// Define storage for uploaded files (temporary before uploading to Cloudinary)

const storage = multer.diskStorage({
  destination: "./public/temp",
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  },
});

// File filter for validation
const fileFilter = (req, file, cb) => {
  // Accept image files only (based on MIME type)
  if (file.mimetype.startsWith("image/")) {
    cb(null, true); // Accept file
  } else {
    cb(new ApiError(400, "Invalid file type. Only images are allowed."), false); // Reject file
  }
};

// Multer middleware with file size limit (e.g., 2MB)

export const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB limit
  fileFilter,
});
