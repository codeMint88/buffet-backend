import { Router } from "express";
import {
  loginUser,
  logoutUser,
  registerUser,
  resendVerificationCode,
  updateUserAvatar,
  updateUserDetails,
  verifyEmail,
} from "../controllers/auth.controller.js";
import {
  avatarLimiter,
  loginLimiter,
  resendVerificationCodeLimiter,
} from "../middlewares/rateLimit.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();
router.route("/register").post(registerUser);
router.route("/verify-email").post(verifyEmail);
router
  .route("/resend-verification-code")
  .post(resendVerificationCodeLimiter, resendVerificationCode);
router.route("/login").post(loginLimiter, loginUser);

// Protected Routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/update-account").post(verifyJWT, updateUserDetails);
router
  .route("/upload-avatar")
  .post(avatarLimiter, verifyJWT, upload.single("avatar"), updateUserAvatar);

export default router;
