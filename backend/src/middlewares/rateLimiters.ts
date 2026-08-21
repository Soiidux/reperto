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
