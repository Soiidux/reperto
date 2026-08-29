import { Request, Response } from "express";
import mongoose from "mongoose";
import Review from "../db/models/review.model";
import Appointment from "../db/models/appointment.model";
import User from "../db/models/user.model";
import { ApiError } from "../errors";

const unauthorizedResponse: ApiResponse<null> = {
  success: false,
  message: "You are not authorized to do this.",
  data: null,
};

export const upsertReview = async (req: Request, res: Response) => {
  const { doctorId, rating, comment } = req.body;

  if (!mongoose.isValidObjectId(doctorId)) {
    throw new ApiError(400, "Invalid doctor id");
  }

  const doctor = await User.findOne({ _id: doctorId, role: "doctor", isActive: true });
  if (!doctor) {
    throw new ApiError(404, "Doctor not found");
  }

  // Reviews require a real completed visit so ratings can't be gamed.
  const hasVisit = await Appointment.exists({
    patientId: req.user.id,
    doctorId,
    status: "completed",
  });
  if (!hasVisit) {
    return res.status(403).json(unauthorizedResponse);
  }

  // One review per (patient, doctor) pair: upserting edits an existing one.
  const review = await Review.findOneAndUpdate(
    { patientId: req.user.id, doctorId },
    { patientId: req.user.id, doctorId, rating, comment },
    { new: true, upsert: true, runValidators: true },
  );

  return res.status(200).json({
    success: true,
    message: "Review saved successfully",
    data: review,
  });
};

export const deleteReview = async (req: Request, res: Response) => {
  const { doctorId } = req.params;

  if (!mongoose.isValidObjectId(doctorId)) {
    throw new ApiError(400, "Invalid doctor id");
  }

  const review = await Review.findOneAndDelete({
    patientId: req.user.id,
    doctorId,
  });
  if (!review) {
    throw new ApiError(404, "Review not found");
  }

  return res.status(200).json({
    success: true,
    message: "Review removed successfully",
    data: review,
  });
};

export const listReviews = async (req: Request, res: Response) => {
  const { doctorId } = req.query;

  if (!mongoose.isValidObjectId(String(doctorId))) {
    throw new ApiError(400, "Invalid doctor id");
  }

  const reviews = await Review.find({ doctorId: String(doctorId) })
    .sort({ createdAt: -1 })
    .populate("patientId", "name profileImageUrl");

  return res.status(200).json({
    success: true,
    message: "Reviews fetched successfully",
    data: reviews,
  });
};