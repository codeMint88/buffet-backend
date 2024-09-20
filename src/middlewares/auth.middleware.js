import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import logger from "../logger.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
  // Retrieve token from cookies or Authorization header
  const authHeader = req.header("Authorization");
  const token =
    req.cookies?.accessToken || (authHeader && authHeader.split(" ")[1]);

  // Return 401 Unauthorized if no token is provided
  if (!token) {
    throw new ApiError(401, "Access token is required.");
  }

  try {
    // Verify the token with the ACCESS_TOKEN_SECRET
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // Find the user by the ID in the decoded token, excluding sensitive fields like password and refreshToken
    const user = await User.findById(decodedToken.userID).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    // Attach the user object to the request and proceed to the next middleware
    req.user = user;
    next();
  } catch (error) {
    logger.error("Error in verifying JWT:", error);

    // Handle JWT-specific errors
    if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, "Access token has expired.");
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(403, "Invalid access token.");
    }

    // Handle any other errors
    throw new ApiError(500, "Internal server error.");
  }
});
