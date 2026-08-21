import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config';
import { Request } from 'express';

const JWT_ISSUER = "reperto";
const JWT_AUDIENCE = "reperto-client";

// Access Token remains a JWT for speed
export const generateAccessToken = (userId: string, role: string) => {
  const payload: jwt.JwtPayload = { userId, role };
  const options: jwt.SignOptions = {
    expiresIn: config.jwt.jwtExpiry as any,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  }
  return jwt.sign(payload, config.jwt.jwtSecret, options);
};

// Refresh Token is now a high-entropy random string
export const generateRefreshToken = () => {
  return crypto.randomBytes(256).toString('hex'); // Generates a 80-character random string
};


//Validate the jwt token
export const validateAccessToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, config.jwt.jwtSecret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return decoded as { userId: string, role: string };
  } catch (error) {
    return null;
  }
}


//Get token from headers
export function getBearerToken(req: Request): string | null{
	const authHeader = req.header("Authorization");
	if (!authHeader) {
    return null;
	}
	if (!authHeader.startsWith("Bearer ")) {
    return null;
	}
	const token = authHeader.split(" ")[1];
	return token;
}
