import express from 'express';
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from 'cors';
import helmet from "helmet";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import appointmentRoutes from "./routes/appointment.routes";
import consultationRoutes from "./routes/consultation.routes";
import leaveRoutes from "./routes/leave.routes";
import adminRoutes from "./routes/admin.routes";
import reportRoutes from "./routes/report.routes";
import reviewRoutes from "./routes/review.routes";
import notificationRoutes from "./routes/notification.routes";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
import { globalLimiter } from "./middlewares/rateLimiters";
import config from "./config";
const app = express();

// Trust exactly one proxy hop so req.ip (and rate limiting) reflect the
// real client instead of the load balancer when deployed behind one.
app.set("trust proxy", 1);

//Middlewares
// API server: no HTML is served, so CSP is disabled; CORP is relaxed so
// cross-origin assets we serve remain usable.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(globalLimiter);
app.use(cors({
  origin: config.clientOrigin,
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(cookieParser());


//Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/appointment", appointmentRoutes);
app.use("/api/consultation", consultationRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/review", reviewRoutes);
app.use("/api/notification", notificationRoutes);

//Health check
app.get("/health", (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  if (!dbUp) {
    return res.status(503).json({
      success: false,
      message: "Database unavailable",
      data: null,
    });
  }
  return res.json({ success: true, message: "OK", data: { db: "up" } });
});

//Production frontend: when the built app exists (frontend/dist), serve it
// from the same origin as the API. One server, no CORS, no second process —
// this is how the site runs in production. Works in both dev run modes:
// tsx (backend/src) and compiled (backend/dist) via __dirname depth.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(currentDir, "../../frontend/dist");
const distIndex = path.join(frontendDist, "index.html");
if (fs.existsSync(distIndex)) {
  app.use(express.static(frontendDist));
  // SPA fallback: any non-API GET (deep links, refreshes) gets the app shell
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(distIndex);
  });
}

//404 + central error handler
app.use(notFound);
app.use(errorHandler);

export default app;
