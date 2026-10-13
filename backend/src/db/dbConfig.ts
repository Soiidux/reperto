import mongoose from 'mongoose';
import config from '../config';
import logger from '../utils/logger';

const MONGODB_URI = config.mongoUri;
export const dbConnect = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    logger.info("Connected to MongoDB");
  } catch (error) {
    logger.error("Failed to connect to MongoDB", {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
};