import { Request, Response } from "express";
import User from "../db/models/user.model";
import Appointment from "../db/models/appointment.model";
import Consultation from "../db/models/consultation.model";
import { getClinicTodayAnchor } from "../utils/clinicDate";

export const getAllUsers = async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 15;
  const skip = (page - 1) * limit;

  const { search, role, isActive } = req.query;
  const query: any = {};

  if (role && role !== "all") query.role = role;
  if (isActive !== undefined && isActive !== "all") query.isActive = isActive === "true";

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const [totalItems, users] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .select("name email phone role gender dateOfBirth bloodGroup profileImageUrl isActive doctorProfile")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const totalPages = Math.ceil(totalItems / limit);

  res.status(200).json({
    success: true,
    message: "Users fetched successfully",
    pagination: {
      totalItems,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    data: users,
  });
};

export const toggleUserActive = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (id === req.user.id) {
    return res.status(400).json({
      success: false,
      message: "You cannot deactivate your own account",
      data: null,
    });
  }

  if (typeof isActive !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "isActive must be a boolean",
      data: null,
    });
  }

  const user = await User.findByIdAndUpdate(
    id,
    { isActive },
    { new: true },
  ).select("_id name email role isActive");

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
      data: null,
    });
  }

  res.status(200).json({
    success: true,
    message: `User ${isActive ? "activated" : "deactivated"}`,
    data: user,
  });
};

export const getStats = async (req: Request, res: Response) => {
  // "Today" anchored to the clinic timezone, stored as UTC midnight
  const todayAnchor = getClinicTodayAnchor();

  const [totalPatients, totalDoctors, totalStaff, totalAppointments, todaysAppointments, pendingAppointments, completedConsultations] =
    await Promise.all([
      User.countDocuments({ role: "patient", isActive: true }),
      User.countDocuments({ role: "doctor", isActive: true }),
      User.countDocuments({ role: "staff", isActive: true }),
      Appointment.countDocuments(),
      Appointment.countDocuments({
        appointmentDate: todayAnchor,
        status: { $ne: "cancelled" },
      }),
      Appointment.countDocuments({ status: "pending" }),
      Consultation.countDocuments(),
    ]);

  res.status(200).json({
    success: true,
    message: "Stats fetched successfully",
    data: {
      totalPatients,
      totalDoctors,
      totalStaff,
      totalAppointments,
      todaysAppointments,
      pendingAppointments,
      completedConsultations,
    },
  });
};