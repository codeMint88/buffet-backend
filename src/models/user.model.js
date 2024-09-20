import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

// Define the user schema with appropriate validations
const userSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    avatarUrl: String,
    refreshToken: String,
    verificationCode: String,
    verificationCodeExpiresAt: Date,
    passwordResetToken: String,
    passwordResetTokenExpiresAt: Date,
  },
  { timestamps: true }
);

// Pre-save hook to hash the password before saving

userSchema.pre("save", async function (next) {
  // if password field is not modified, return next
  if (!this.isModified("password")) return next();

  try {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to check if a password is correct
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Utility function to generate JWT tokens
const generateToken = (payload, secret, expiresIn) => {
  return jwt.sign(payload, secret, { expiresIn });
};

// Generate access token
userSchema.methods.generateAccessToken = function () {
  return generateToken(
    {
      userID: this._id,
      email: this.email,
      issuedAt: Date.now(),
    },
    process.env.ACCESS_TOKEN_SECRET,
    process.env.ACCESS_TOKEN_EXPIRY
  );
};

// Generate refresh token
userSchema.methods.generateRefreshToken = function () {
  return generateToken(
    {
      userID: this._id,
      issuedAt: Date.now(),
    },
    process.env.REFRESH_TOKEN_SECRET,
    process.env.REFRESH_TOKEN_EXPIRY
  );
};

// Cookie options
userSchema.methods.cookiesOptions = (maxAge = 3600000) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // Use secure cookies in production
  sameSite: "strict", // Prevent CSRF attacks
  maxAge, // 1 hour in milliseconds and set as default
});

//Global Sensitive Field Removal
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

export const User = mongoose.model("User", userSchema);
