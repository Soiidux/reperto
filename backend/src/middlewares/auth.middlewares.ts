import { Request, Response, NextFunction } from 'express';
import { getBearerToken, validateAccessToken } from '../utils/token';

export const protect = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    const decoded = validateAccessToken(token);
    if (!decoded) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = {
      id: decoded.userId,
      role: decoded.role,
    };
    next();
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error' });
  }
}


export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  }
}