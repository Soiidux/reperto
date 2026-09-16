import { Request, Response } from "express";
import User from "../db/models/user.model";
import Appointment from "../db/models/appointment.model";
import Consultation from "../db/models/consultation.model";
import Invoice from "../db/models/invoice.model";
import { getClinicTodayAnchor } from "../utils/clinicDate";
import { formatInTimeZone } from "date-fns-tz";
import { CLINIC_TIMEZONE } from "../constants/clinic";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rolling 12 calendar months (clinic timezone), most-recent first, each with
 * the zero-filled sum for the given amount. Bucketing happens in JS so month
 * boundaries match the clinic's calendar rather than UTC.
 */
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const lastTwelveMonthBuckets = (
  rows: { createdAt: Date; amount: number }[],
) => {
  const monthKey = (date: Date) =>
    formatInTimeZone(date, CLINIC_TIMEZONE, "yyyy-MM");

  const [cy, cm] = formatInTimeZone(new Date(), CLINIC_TIMEZONE, "yyyy-MM")
    .split("-")
    .map(Number);

  const buckets: { month: string; label: string; value: number }[] = [];
  for (let back = 11; back >= 0; back -= 1) {
    let month = cm - back;
    let year = cy;
    while (month <= 0) {
      month += 12;
      year -= 1;
    }
    buckets.push({
      month: `${year}-${String(month).padStart(2, "0")}`,
      label: `${MONTH_LABELS[month - 1]} ${String(year).slice(2)}`,
      value: 0,
    });
  }

  const map = new Map(buckets.map((b) => [b.month, b]));
  for (const row of rows) {
    const bucket = map.get(monthKey(row.createdAt));
    if (bucket) bucket.value += row.amount;
  }
  return buckets;
};

export const getAnalytics = async (req: Request, res: Response) => {
  const today = getClinicTodayAnchor();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * DAY_MS);

  // 1. Revenue per month from paid invoices (last 12 clinic months).
  const paidInvoices = await Invoice.find({
    status: "paid",
    createdAt: { $gte: new Date(today.getTime() - 365 * DAY_MS) },
  })
    .select("createdAt amount")
    .lean();
  const revenueByMonth = lastTwelveMonthBuckets(
    paidInvoices.map((i: any) => ({ createdAt: i.createdAt, amount: i.amount })),
  );

  // 2. Appointment mix by doctor (last 30 clinic days).
  const byDoctorRows = await Appointment.aggregate([
    { $match: { appointmentDate: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { doctorId: "$doctorId", status: "$status" }, count: { $sum: 1 } } },
  ]);
  const doctorTotals = new Map<string, number>();
  const doctorStatuses = new Map<string, Record<string, number>>();
  for (const row of byDoctorRows) {
    const docId = String(row._id.doctorId);
    doctorTotals.set(docId, (doctorTotals.get(docId) ?? 0) + row.count);
    const statuses = doctorStatuses.get(docId) ?? {};
    statuses[row._id.status] = (statuses[row._id.status] ?? 0) + row.count;
    doctorStatuses.set(docId, statuses);
  }
  const doctors = await User.find({ _id: { $in: Array.from(doctorTotals.keys()) } })
    .select("name")
    .lean();
  const appointmentsByDoctor = doctors.map((d) => ({
    doctorId: d._id.toString(),
    doctorName: (d.name || "").replace(/^Dr\.?\s+/i, ""),
    total: doctorTotals.get(d._id.toString()) ?? 0,
    statuses: doctorStatuses.get(d._id.toString()) ?? {},
  }));

  // 3. Overall appointment status mix.
  const statusRows = await Appointment.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const statusRates = statusRows.map((row) => ({
    status: row._id,
    count: row.count,
  }));
  const totalAppointments30d = Array.from(doctorTotals.values()).reduce((a, b) => a + b, 0);

  // 4. New patient registrations per month (last 12 clinic months).
  const patients = await User.find({
    role: "patient",
    createdAt: { $gte: new Date(today.getTime() - 365 * DAY_MS) },
  })
    .select("createdAt")
    .lean();
  const newPatientsByMonth = lastTwelveMonthBuckets(
    patients.map((p: any) => ({ createdAt: p.createdAt, amount: 1 })),
  ).map((b) => ({ month: b.month, label: b.label, count: b.value }));

  res.status(200).json({
    success: true,
    message: "Analytics fetched successfully",
    data: {
      revenueByMonth,
      appointmentsByDoctor,
      statusRates,
      totalAppointments30d,
      newPatientsByMonth,
    },
  });
};

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

  const [totalPatients, totalDoctors, totalStaff, totalAppointments, todaysAppointments, pendingAppointments, completedConsultations, totalInvoices, totalPaidInvoices, totalCancelledInvoices, collectedRevenue] =
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
      Invoice.countDocuments(),
      Invoice.countDocuments({ status: "paid" }),
      Invoice.countDocuments({ status: "cancelled" }),
      Invoice.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]).then((rows) => rows[0]?.total ?? 0),
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
      totalInvoices,
      totalPaidInvoices,
      totalCancelledInvoices,
      collectedRevenue,
    },
  });
};