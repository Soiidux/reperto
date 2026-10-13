/**
 * Minimal structured logger.
 *
 * The codebase previously logged with bare `console.error`, which gave no
 * timestamp, no level, and no request context — diagnosing the Cloudinary PDF
 * failure meant reading raw log dumps by hand. This keeps zero dependencies
 * (important for a backend that must boot anywhere) while emitting one JSON
 * object per line in production and a readable line in development.
 *
 * Every line carries an ISO timestamp and a level; callers can attach context
 * (user id, request id, appointment id) as a second argument.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Honour LOG_LEVEL (defaults to info; warn+ only in production).
const configuredLevel = (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info";
const minLevel = LEVEL_ORDER[configuredLevel] ?? LEVEL_ORDER.info;
const isProd = process.env.NODE_ENV === "production";

export type LogContext = Record<string, unknown>;

const emit = (level: LogLevel, message: string, context?: LogContext) => {
  if (LEVEL_ORDER[level] < minLevel) return;

  if (isProd) {
    // One JSON object per line: greppable by log shippers.
    const line = JSON.stringify({
      level,
      time: new Date().toISOString(),
      message,
      ...(context ?? {}),
    });
    // console is deliberate here: stdout is what a log collector reads.
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
    return;
  }

  const suffix = context && Object.keys(context).length > 0
    ? " " + JSON.stringify(context)
    : "";
  const line = `[${new Date().toISOString()}] ${level.toUpperCase().padEnd(5)} ${message}${suffix}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
};

export default logger;