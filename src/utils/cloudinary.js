import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";
import logger from "../logger.js";

// Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (
  localFilePath,
  transformation = []
) => {
  if (!localFilePath) return null;

  try {
    // Upload an image
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // Optional transformation (default or user-provided)
    const imageUrl = cloudinary.url(response.public_id, {
      transformation:
        transformation.length > 0
          ? transformation
          : [
              { quality: "auto", fetch_format: "auto" },
              { width: 400, height: 400, crop: "fill", gravity: "auto" },
            ],
    });

    // logger.info("Sucessfully uploaded image to cloudinary");

    await fs.unlink(localFilePath);

    return { imageUrl, response };
  } catch (error) {
    // Remove the temporary local file even on error
    await fs.unlink(localFilePath).catch((err) => {
      logger.error(`Failed to delete temporary file: ${localFilePath}`, {
        err,
      });
    });

    logger.error("Failed to upload image to Cloudinary", { error });

    return null;
  }
};

export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info(`Deleted from cloudinary. Public ID: ${publicId}`);
  } catch (error) {
    logger.error(`Error deleting ${publicId} from cloudinary`, {
      error,
    });

    return null;
  }
};
