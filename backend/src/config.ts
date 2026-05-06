import dotenv from 'dotenv';

dotenv.config();

type Config = {
  port: number;
  mongoUri: string;
  jwtSecret: string;
};

const config: Config = {
  port: parseInt(process.env.PORT || '5000'),
  mongoUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
};

export default config;

