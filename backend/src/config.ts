import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRY: z.string().min(1, "JWT_EXPIRY is required (e.g. 15m)"),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  CLOUDINARY_NAME: z.string().min(1, "CLOUDINARY_NAME is required"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.preprocess(
    (v) => (v === "" || v === undefined ? 587 : v),
    z.coerce.number().int().positive(),
  ),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("Reperto <reperto@example.com>"),
  CLINIC_PHONE: z.string().default("+91 98765 43210"),
  CLINIC_EMAIL: z.string().default("care@reperto.example"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = parsed.data;

type CloudinaryConfig = {
  name: string;
  apiKey: string;
  apiSecret: string;
};

type JwtConfig = {
  jwtSecret: string;
  jwtExpiry: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

type ClinicConfig = {
  phone: string;
  email: string;
};

type Config = {
  port: number;
  nodeEnv: string;
  isProd: boolean;
  mongoUri: string;
  clientOrigin: string;
  jwt: JwtConfig;
  cloudinary: CloudinaryConfig;
  smtp: SmtpConfig;
  clinic: ClinicConfig;
};

const config: Config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  isProd: env.NODE_ENV === "production",
  mongoUri: env.MONGODB_URI,
  clientOrigin: env.CLIENT_ORIGIN,
  jwt: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiry: env.JWT_EXPIRY,
  },
  cloudinary: {
    name: env.CLOUDINARY_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
  },
  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.SMTP_FROM,
  },
  clinic: {
    phone: env.CLINIC_PHONE,
    email: env.CLINIC_EMAIL,
  },
};

// In production an SMTP host must be configured so password-reset and
// verification emails actually reach users; the console transport is a
// development/testing convenience only.
if (config.isProd && !config.smtp.host) {
  console.error(
    "SMTP_HOST is required in production so email features can deliver mail.",
  );
  process.exit(1);
}

export default config;
