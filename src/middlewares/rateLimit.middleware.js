import rateLimit from "express-rate-limit";

// Define rate limiter
export const resendVerificationCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per windowMs
  message: {
    status: 429,
    message:
      "Too many verification code requests. Please try again in 30 minutes.",
  },
});

export const loginLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 5,
  message: {
    status: 429,
    message: "Too many verification code requests. Please try again in 1 hour.",
  },
});

export const avatarLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 2,
  message: {
    status: 429,
    message:
      "Too many change of profile picture requests. Please try again in 24 hours.",
  },
});
