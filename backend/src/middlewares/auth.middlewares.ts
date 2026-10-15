import { Request, Response, NextFunction } from 'express';
import User from '../db/models/user.model';
import { getBearerToken, validateAccessToken } from '../utils/token';
import { can, type Permission } from '../utils/permissions';

// Short-lived in-memory cache for the account check on `protect`.
//
// Why: every authenticated request previously did its own DB round trip just
// to re-verify the account (the app's DB is a remote cluster, ~100ms per
// trip), so every single API call paid an extra ~100ms tax.
//
// Trade-off: a deactivated user keeps access for at most AUTH_CHECK_TTL_MS
// after being disabled instead of losing it on the very next request. 30s
// keeps the window tight while removing ~100ms from every call. Logout
// evicts the entry (see evictAuthCache) so the next request re-checks the
// DB directly; the access token itself stays valid until its short expiry,
// and the browser session is ended by revoking the refresh token.
const AUTH_CHECK_TTL_MS = 30_000;
const AUTH_CACHE_MAX = 10_000;
const authCache = new Map<
  string,
  { role: string; isActive: boolean; expiresAt: number }
>();

const getCachedAccount = async (userId: string) => {
  const cached = authCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }
  const user = await User.findById(userId).select('role isActive').lean();
  if (!user) {
    return null;
  }
  // Crude bound: if the cache grows past its cap, reset it rather than let a
  // leak grow forever. With a clinic-sized user base this never triggers.
  if (authCache.size >= AUTH_CACHE_MAX) {
    authCache.clear();
  }
  const entry = {
    role: user.role,
    isActive: user.isActive as boolean,
    expiresAt: Date.now() + AUTH_CHECK_TTL_MS,
  };
  authCache.set(userId, entry);
  return entry;
};

/** Drop a user from the auth cache, e.g. right after logout. */
export const evictAuthCache = (userId: string) => {
  authCache.delete(userId);
};

/** Marks this handler as the authentication guard, for the OpenAPI generator. */
export const AUTH_REQUIRED = Symbol("authRequired");

export const protect = Object.assign(
  async (req: Request, res: Response, next: NextFunction) => {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Invalid token', data: null });
    }
    const decoded = validateAccessToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid token', data: null });
    }
    // Re-check the account so deactivated/deleted users lose access quickly,
    // backed by a short-lived cache instead of a DB round trip per request.
    const account = await getCachedAccount(decoded.userId);
    if (!account || !account.isActive) {
      return res.status(401).json({ success: false, message: 'Account is disabled or no longer exists', data: null });
    }
    req.user = {
      id: decoded.userId,
      role: account.role,
    };
    next();
  },
  { [AUTH_REQUIRED]: true },
);


export type PermissionGuard = ((
  req: Request,
  res: Response,
  next: NextFunction,
) => void) & {
  /**
   * Attached so the OpenAPI generator can read the real capability off the
   * route stack. Deriving it from the live middleware is what keeps the
   * published spec honest: a route cannot claim a capability its guard does
   * not enforce, and a guard added to a route shows up in the docs with no
   * second declaration to update.
   */
  permission: Permission;
};

/**
 * Route guard by *capability* rather than a raw role list.
 *
 * The role list lives once, in PERMISSIONS (utils/permissions.ts), so a route
 * states what it does and the matrix answers who may do it.
 *
 * Kept the same 403 shape as before so existing clients are unaffected.
 */
export const requirePermission = (permission: Permission): PermissionGuard => {
  const guard = ((req: Request, res: Response, next: NextFunction) => {
    if (!can(req.user?.role, permission)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
        data: null,
      });
    }
    next();
  }) as unknown as PermissionGuard;

  guard.permission = permission;
  return guard;
};
