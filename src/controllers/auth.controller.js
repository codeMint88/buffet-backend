import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import logger from "../logger.js";

import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { generateVerificationCode } from "../utils/generateVerificationCode.js";
import { sendVerificationEmail } from "../mailtrap/emails.js";
import {
  deleteFromCloudinary,
  uploadToCloudinary,
} from "../utils/cloudinary.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;

    // The user document was just fetched and should be valid. We use the validateBeforeSave option so that the document is saved directly to the database without checking if it meets the schema requirements. This can significantly speed up the save operation, especially for large documents or when you're certain the data is valid.
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    logger.info(
      `Something went wrong while generating referesh and access token for ${userId}`
    );
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

export const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend
  const { userName, email, password } = req.body;

  // validation - not empty
  if ([userName, email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required.");
  }

  // check if user already exists: username
  const existedUserName = await User.findOne({ userName });

  if (existedUserName) {
    throw new ApiError(409, "Username already exists!");
  }

  // check if user already exists: email
  const existedUserEmail = await User.findOne({ email });

  if (existedUserEmail) {
    throw new ApiError(409, "Email already exists!");
  }

  // generate verification code
  const verificationCode = generateVerificationCode();

  // create user object - create entry in db
  const user = await User.create({
    userName,
    email,
    password,
    verificationCode,
    verificationCodeExpiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  });

  // get the newly created user from db and remove password and refresh token field from response
  // You can also do this:
  // const createdUser = await User.findOne({
  //   $or: [{ userName, email }],
  // }).select("-password -refreshToken");

  const createdUser = await User.findById(user._id);

  if (!createdUser) {
    throw new ApiError(
      500,
      "Something went wrong while registering a new user."
    );
  }
  // Send verification email
  await sendVerificationEmail(createdUser.email, createdUser.verificationCode);

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "New user created successfully"));
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    throw new ApiError(400, "Verification code is required.");
  }

  // get the newly created user from db and remove password and refresh token field from response
  const user = await User.findOne({ verificationCode: code }).select(
    "-password -refreshToken"
  );

  // check if the user does not exist
  if (!user) {
    throw new ApiError(422, "Invalid Verification Code! Please register.");
  }

  // check if the user's verification code has expired
  if (user.verificationCodeExpiresAt < Date.now()) {
    throw new ApiError(
      422,
      "Verification Code has expired. Please request a new one."
    );
  }

  //update user's properties in the database: Mark the user as verified and clean up verification fields
  user.isVerified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpiresAt = undefined;

  await user.save({ validateBeforeSave: false });

  // await sendWelcomeEmail(user.email)

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Email verified successfully"));
});

export const resendVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Ensure email is provided
  if (!email) {
    throw new ApiError(400, "Email is required.");
  }

  // Find the user by email. Frontend redirects user to register if not found.
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User not found! Pease register.");
  }

  // If the user is already verified, send a response and return early
  if (user.isVerified) {
    return res
      .status(409)
      .json(
        new ApiResponse(409, null, "User already verified. Redirect to login.")
      );
  }

  // Check if the current verification code has expired. If it has not expire, frontend will redirect user to verification page

  const currentTime = Date.now();
  if (user.verificationCodeExpiresAt > currentTime) {
    const remainingTimeInMinutes = Math.ceil(
      (user.verificationCodeExpiresAt - currentTime) / 1000 / 60
    );

    if (remainingTimeInMinutes > 60) {
      const remainingTimeInHours = Math.ceil(remainingTimeInMinutes / 60);
      throw new ApiError(
        403, // 403 Forbidden for trying to get a new code while one is still valid
        `Please wait for ${remainingTimeInHours} hour(s) before requesting a new verification code. Check your spam folder if you haven not received it.`
      );
    }

    throw new ApiError(
      403,
      `You must wait ${remainingTimeInMinutes} minute(s) before requesting a new verification code. Please check your spam folder and verify using the current code.`
    );
  }

  // Generate a new verification code and update expiration
  const newVerificationCode = generateVerificationCode();

  user.verificationCode = newVerificationCode;
  user.verificationCodeExpiresAt = currentTime + 24 * 60 * 60 * 1000;

  await user.save();

  try {
    await sendVerificationEmail(user.email, newVerificationCode);
  } catch (error) {
    throw new ApiError(
      500,
      "Failed to send verification email. Try again later."
    );
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, null, "New verification code sent successfully.")
    );
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if ([email, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  // get the newly created user from db. Frontend should redirect to registration page if user is not registered
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User not registered.");
  }

  // Validate password
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid password.");
  }

  // Check if user is verified. Frontend should redirect user to the verification page if user is not verified.
  if (!user.isVerified) {
    throw new ApiError(403, "User is not verified.");
  }

  // Generate access and refresh tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // Update user's last login time and refresh token
  user.lastLogin = Date.now();
  user.refreshToken = refreshToken;
  await user.save();

  // cookiesOptions is a method defined in user model. It sets maxAge to 1hr if not provided in funtion call.
  const options = user.cookiesOptions();

  res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

export const refreshAccessToken = asyncHandler(async (req, res) => {
  // Retrieve refresh token from cookie or body
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;

  // 400 Bad Request if no token is provided
  if (!incomingRefreshToken) {
    throw new ApiError(400, "Refresh token is required.");
  }

  try {
    // Verify the refresh token
    const decodedRefreshToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    // Find the user associated with the decoded token
    const user = await User.findById(decodedRefreshToken._id);

    // 404 Not Found if the user doesn't exist
    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    // 403 Forbidden if the incoming token doesn't match the one stored in the database
    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(403, "Invalid refresh token.");
    }

    // Generate new access and refresh tokens
    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    // Update user's refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    // Set cookies with the new tokens
    const options = user.cookiesOptions();
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access token refreshed successfully."
        )
      );
  } catch (error) {
    // Handle specific JWT errors
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, "Refresh token has expired.");
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(403, "Invalid refresh token.");
    }

    // Handle any other errors
    throw new ApiError(500, "Internal server error.");
  }
});

export const logoutUser = asyncHandler(async (req, res) => {
  // Ensure the user is authenticated
  if (!req.user || !req.user._id) {
    throw new ApiError(401, "User is not authenticated.");
  }

  // Log the attempt to logout
  logger.info("User about to be logged out", { userId: req.user._id });

  // Remove the refresh token from the user's document in the database
  const user = await User.findByIdAndUpdate(req.user._id, {
    $unset: { refreshToken: 1 }, // Remove the refreshToken field from the document
  });

  // Handle case where the user is not found
  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  // Log the successful logout
  logger.info("User logged out successfully", { userId: user._id });

  const options = user.cookiesOptions();
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, null, "User logged out successfully."));
});

export const updateUserDetails = asyncHandler(async (req, res) => {
  const { firstName, lastName } = req.body;

  if (!firstName & !lastName) {
    throw new ApiError(
      400,
      "At least one field (firstName or lastName) is required."
    );
  }

  // Patch first name and last name
  const updateData = {};
  if (firstName) updateData.firstName = firstName.trim();
  if (lastName) updateData.lastName = lastName.trim();

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: updateData,
    },
    { new: true, runValidators: true }
  );

  if (!user) throw new ApiError(404, "User not found");

  logger.info(
    `User ${user._id} updated ${firstName ? { firstName } : { lastName }} `
  );

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

export const updateUserAvatar = asyncHandler(async (req, res) => {
  // Ensure the file is uploaded
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Profile picture is required.");
  }

  let cloudinaryResponse;

  try {
    // Upload the avatar to Cloudinary.
    // You can also define a transformation array and pass it as a second parameter to the uploadToCloudinary function, else the default trasformation defined in the function will be used instead
    const { imageUrl, response } = await uploadToCloudinary(avatarLocalPath);

    cloudinaryResponse = response; // Assign cloudinary response for potential rollback

    if (!imageUrl) {
      throw new ApiError(500, "Error uploading profile picture");
    }

    // Update the user's avatar URL in the database
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { avatarUrl: imageUrl } },
      { new: true, runValidators: true }
    );

    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, user, "Profile image updated successfully"));
  } catch (error) {
    logger.error(
      `Failed to upload profile picture for user ${req.user.id}`,
      error
    );

    // Clean up Cloudinary upload if necessary
    if (cloudinaryResponse?.public_id) {
      await deleteFromCloudinary(cloudinaryResponse.public_id);
    }

    throw new ApiError(
      500,
      "Unable to upload profile picture. Try again later."
    );
  }
});
