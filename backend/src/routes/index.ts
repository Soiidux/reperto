import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import appointmentRoutes from "./appointment.routes";
import consultationRoutes from "./consultation.routes";
import leaveRoutes from "./leave.routes";
import adminRoutes from "./admin.routes";
import reportRoutes from "./report.routes";
import reviewRoutes from "./review.routes";
import notificationRoutes from "./notification.routes";
import clinicRoutes from "./clinic.routes";

/**
 * The single list of mounted routers.
 *
 * It lives here rather than in app.ts so both the server and the OpenAPI
 * generator can read it without a circular import: app.ts mounts from this
 * list, and docs.routes.ts discovers routes from the same one.
 *
 * Sharing the list is what keeps the published specification honest. A
 * hand-written list of endpoints in the generator would inevitably disagree
 * with the routes that are actually served — a new endpoint would go live
 * undocumented, and a renamed one would linger in the spec. Here, adding a
 * mount adds it to the docs in the same commit.
 */
export const API_ROUTES: { prefix: string; router: Router; tag: string }[] = [
  { prefix: "/auth", router: authRoutes, tag: "Authentication" },
  { prefix: "/user", router: userRoutes, tag: "Users" },
  { prefix: "/appointment", router: appointmentRoutes, tag: "Appointments" },
  { prefix: "/consultation", router: consultationRoutes, tag: "Consultations" },
  { prefix: "/leave", router: leaveRoutes, tag: "Doctor leave" },
  { prefix: "/admin", router: adminRoutes, tag: "Administration" },
  { prefix: "/report", router: reportRoutes, tag: "Reports" },
  { prefix: "/review", router: reviewRoutes, tag: "Reviews" },
  { prefix: "/notification", router: notificationRoutes, tag: "Notifications" },
  { prefix: "/clinic", router: clinicRoutes, tag: "Clinic" },
];