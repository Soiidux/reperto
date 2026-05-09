import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config';

// Access Token remains a JWT for speed
export const generateAccessToken = (userId: string, role: string) => {
  const payload: jwt.JwtPayload = { userId, role };
  const options: jwt.SignOptions = {expiresIn: config.jwt.jwtExpiry as any}
  return jwt.sign(payload, config.jwt.jwtSecret, options);
};

// Refresh Token is now a high-entropy random string
export const generateRefreshToken = () => {
  return crypto.randomBytes(256).toString('hex'); // Generates a 80-character random string
};


//Validate the jwt token
export const validateAcessToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, config.jwt.jwtSecret);
    return decoded as { userId: string, role: string };
  } catch (error) {
    console.error("Token invalid or expired");
    return null;
  }
}


//Get token from headers
export function getBearerToken(req: Request): string {
	const authHeader = req.headers.get("Authorization");
	if (!authHeader) {
		throw new Error("No Authorization header");
	}
	if (!authHeader.startsWith("Bearer ")) {
		throw new Error("Invalid Authorization format");
	}
	const token = authHeader.split(" ")[1];
	return token;
}
