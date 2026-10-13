import app from './app';
import config from './config';
import { dbConnect } from './db/dbConfig';
import logger from './utils/logger';
const PORT = config.port;
import appointmentModel from './db/models/appointment.model';
import consultationModel from './db/models/consultation.model';
import leaveModel from './db/models/leave.model';
import tokenModel from './db/models/token.model';
import userModel from './db/models/user.model';
import bookingHoldModel from './db/models/bookingHold.model';
import accessLogModel from './db/models/accessLog.model';
import { startAppointmentRemindersJob } from './jobs/appointmentReminders';
import { startFollowUpRemindersJob } from './jobs/followUpReminders';

const models = [
  appointmentModel,
  consultationModel,
  leaveModel,
  tokenModel,
  userModel,
  bookingHoldModel,
  accessLogModel,
];

// ── Crash handlers ───────────────────────────────────────────────────────────
// Without these, a rejected promise inside a background job (or anywhere else
// off the request path) is swallowed by Node's default handler and the process
// keeps limping along in an undefined state. Log loudly, then exit so the
// supervisor restarts us cleanly rather than leaving a zombie.
let shuttingDown = false;

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    reason: reason instanceof Error ? reason.stack ?? reason.message : String(reason),
  });
  shutdown("unhandledRejection");
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error: error.stack ?? error.message });
  shutdown("uncaughtException");
});

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.warn("Shutting down", { signal });
  // Give the logger a tick to flush before exiting.
  setTimeout(() => process.exit(1), 50);
}

// Log every uncaught warning but do not treat them as fatal.
process.on("warning", (warning) => {
  logger.warn("Process warning", { warning: warning.name, detail: warning.message });
});

dbConnect()
  .then(async () => {
    for (const model of models) {
      await model.syncIndexes();
    }
    logger.info("Indexes synced", { models: models.length });

    startAppointmentRemindersJob();
    startFollowUpRemindersJob();

    const server = app.listen(PORT, () => {
      logger.info("Server is running", { port: PORT, env: config.nodeEnv });
    });

    server.on("error", (error) => {
      logger.error("HTTP server error", { message: error.message });
    });
  })
  .catch((error: unknown) => {
    logger.error("Failed to start", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  });