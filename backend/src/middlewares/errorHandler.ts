import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { MongoServerError } from "mongodb";
import multer from "multer";
import { ApiError } from "../errors";

export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let status = 500;
  let message = "Internal server error";

  if (err instanceof ApiError) {
    status = err.status;
    message = err.message;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = "Invalid request data";
  } else if (err instanceof mongoose.Error.CastError) {
    // Keep field internals out of client responses
    status = 400;
    message = "Invalid request parameter";
  } else if (
    err instanceof MongoServerError &&
    typeof err.code === "number" &&
    err.code === 11000
  ) {
    status = 409;
    message = "Duplicate resource conflict";
  } else if (err instanceof multer.MulterError) {
    status = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File too large (max 2 MB)"
        : "File upload error";
  } else if (err instanceof SyntaxError && "body" in (err as object)) {
    status = 400;
    message = "Malformed JSON body";
  } else if (
    typeof (err as { statusCode?: unknown })?.statusCode === "number" &&
    (err as { statusCode: number }).statusCode >= 400 &&
    (err as { statusCode: number }).statusCode < 500
  ) {
    // body-parser and similar middleware errors carry a statusCode
    const statusCode = (err as { statusCode: number }).statusCode;
    status = statusCode;
    message =
      statusCode === 413 ? "Request payload too large" : "Invalid request";
  }

  if (status >= 500) {
    console.error(`[${req.method}] ${req.originalUrl} -> ${status}`, err);
  }

  res.status(status).json({
    success: false,
    message,
    data: null,
  });
};
