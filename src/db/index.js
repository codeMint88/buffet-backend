import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import logger from "../logger.js";

export const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    // console.log(connectionInstance);
    logger.info(
      `MongoDB connected!! \nHost Name: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    logger.error("Failed to connect to MongoDB: \n", error);
  }
};
