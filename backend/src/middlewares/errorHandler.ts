import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { MongoServerError } from "mongodb";
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
    status = 400;
    message = `Invalid value for "${err.path}"`;
  } else if (
    err instanceof MongoServerError &&
    typeof err.code === "number" &&
    err.code === 11000
  ) {
    status = 409;
    message = "Duplicate resource conflict";
  } else if (err instanceof SyntaxError && "body" in (err as object)) {
    status = 400;
    message = "Malformed JSON body";
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
