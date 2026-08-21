import express from 'express';
import cors from 'cors';
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import appointmentRoutes from "./routes/appointment.routes";
import consultationRoutes from "./routes/consultation.routes";
import leaveRoutes from "./routes/leave.routes";
import adminRoutes from "./routes/admin.routes";
import { errorHandler } from "./middlewares/errorHandler";
import { notFound } from "./middlewares/notFound";
const app = express();

//Middlewares
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


//Routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/appointment", appointmentRoutes);
app.use("/api/consultation", consultationRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/admin", adminRoutes);

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

//404 + central error handler
app.use(notFound);
app.use(errorHandler);

export default app;
