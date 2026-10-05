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

  // Aggregate here so a doctor's reviews view is self-sufficient — the UI
  // shouldn't have to join this against the doctors endpoint for the totals.
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let ratingSum = 0;
  for (const review of reviews) {
    distribution[review.rating] = (distribution[review.rating] ?? 0) + 1;
    ratingSum += review.rating;
  }
  const summary = {
    avgRating:
      reviews.length > 0
        ? Math.round((ratingSum / reviews.length) * 10) / 10
        : 0,
    totalReviews: reviews.length,
    distribution,
  };

  // Rating is gated on a completed visit (the same rule upsertReview
  // enforces). Reporting it up front lets the UI explain why the form is
  // unavailable, instead of letting a patient fill it in only to hit a 403.
  let canReview = false;
  let myReview: (typeof reviews)[number] | null = null;
  if (req.user.role === "patient") {
    myReview =
      reviews.find((r) => r.patientId._id.toString() === req.user.id) ?? null;
    canReview =
      Boolean(myReview) ||
      Boolean(
        await Appointment.exists({
          patientId: req.user.id,
          doctorId: String(doctorId),
          status: "completed",
        }),
      );
  }

  return res.status(200).json({
    success: true,
    message: "Reviews fetched successfully",
    data: { reviews, summary, canReview, myReview },
  });
};