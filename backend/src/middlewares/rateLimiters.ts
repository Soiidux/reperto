import rateLimit from "express-rate-limit";

const tooManyRequests = (message: string) => ({
  success: false,
  message,
  data: null,
});

const standardOptions = {
  standardHeaders: true,
  legacyHeaders: false,
  // CORS preflights are browser-driven and must never count against limits
  skip: (req: { method: string }) => req.method === "OPTIONS",
};

export const globalLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 1000,
  limit: 300,
  message: tooManyRequests("Too many requests, please try again later"),
});

export const authLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 1000,
  limit: 20,
  message: tooManyRequests("Too many attempts, please try again later"),
});

export const refreshLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 1000,
  limit: 30,
  message: tooManyRequests("Too many refresh attempts, please log in again"),
});

export const bookingLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 1000,
  limit: 30,
  message: tooManyRequests("Too many requests, please slow down"),
});

// Generous per-minute budget for a busy reception desk scanning tickets.
export const checkInLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 1000,
  limit: 120,
  message: tooManyRequests("Too many check-in attempts, please slow down"),
});

// Front-desk status edits (staff/admin may move a booking to any status).
// Generous enough for a fast-moving queue (1 edit/sec), but still bounds
// runaway loops and double-clicked controls. Role fencing stays in the route
// via protect/authorize.
export const statusLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 1000,
  limit: 60,
  message: tooManyRequests("Too many status changes, please slow down"),
});
