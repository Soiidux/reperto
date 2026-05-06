import mongoose from 'mongoose';
import config from '../config';

const MONGODB_URI = config.mongoUri;
export const dbConnect = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  }
};