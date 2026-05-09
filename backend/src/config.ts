import dotenv from 'dotenv';

dotenv.config();

type CloudinaryConfig = {
  name: string;
  apiKey: string;
  apiSecret: string;
};

type JwtConfig = {
  jwtSecret: string;
  jwtExpiry: string;
}
type Config = {
  port: number;
  mongoUri: string;
  jwt: JwtConfig;
  cloudinary: CloudinaryConfig;
};

const config: Config = {
  port: parseInt(process.env.PORT || '5000'),
  mongoUri: process.env.MONGODB_URI || '',
  jwt: {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiry:process.env.JWT_EXPIRY || '',
  },
  cloudinary: {
    name: process.env.CLOUDINARY_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
  },
};

export default config;

