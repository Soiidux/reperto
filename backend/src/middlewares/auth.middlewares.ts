import { Request, Response, NextFunction } from 'express';
import User from '../db/models/user.model';
import { getBearerToken, validateAccessToken } from '../utils/token';

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Invalid token', data: null });
  }
  const decoded = validateAccessToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Invalid token', data: null });
  }
  // Re-check the account on every request so deactivated/deleted users
  // lose access immediately instead of at token expiry
  const user = await User.findById(decoded.userId).select('role isActive');
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: 'Account is disabled or no longer exists', data: null });
  }
  req.user = {
    id: user._id.toString(),
    role: user.role,
  };
  next();
}


export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  }
}
