import { Request, Response } from "express";
import bcrypt from "bcrypt";
import User from "../db/models/user.model";
import Appointment from "../db/models/appointment.model";
import Consultation from "../db/models/consultation.model";
import { getClinicTodayAnchor, parseDateAnchor } from "../utils/clinicDate";
import { formatInTimeZone } from "date-fns-tz";
import { CLINIC_TIMEZONE } from "../constants/clinic";
import { toCsv } from "../utils/csv";
import ClinicBlockout from "../db/models/clinicBlockout.model";
import ClinicSettings from "../db/models/clinicSettings.model";
import {
  buildUserSearchFilter,
  USER_SEARCH_COLLATION,
} from "../utils/userSearch";

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

  // 1. Appointment mix by doctor (last 30 clinic days).
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

  // 2. Overall appointment status mix.
  const statusRows = await Appointment.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const statusRates = statusRows.map((row) => ({
    status: row._id,
    count: row.count,
  }));
  const totalAppointments30d = Array.from(doctorTotals.values()).reduce((a, b) => a + b, 0);

  // 3. New patient registrations per month (last 12 clinic months).
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
    // Escaped, prefix-anchored and collation-aware so the directory search
    // uses an index instead of scanning every user on each keystroke.
    const searchFilter = buildUserSearchFilter(search);
    if (searchFilter) query.$or = searchFilter.$or as Record<string, unknown>[];
  }

  const [totalItems, users] = await Promise.all([
    User.countDocuments(query).collation(USER_SEARCH_COLLATION),
    User.find(query)
      .select("name email phone role gender dateOfBirth bloodGroup profileImageUrl isActive doctorProfile")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .collation(USER_SEARCH_COLLATION)
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

// Admin creates a doctor or front-desk staff account. The creator vouches
// for the person, so the account starts activated and email-verified, and
// no verification email is needed. Role is locked to doctor/staff — the
// admin UI can never mint another admin.
export const createTeamMember = async (req: Request, res: Response) => {
  const {
    name,
    email,
    password,
    phone,
    gender,
    dateOfBirth,
    bloodGroup,
    role,
    doctorProfile,
  } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "A user with this email already exists",
      data: null,
    });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    phone,
    role,
    gender,
    dateOfBirth,
    bloodGroup,
    accountType: "self",
    isActive: true,
    emailVerified: true,
    ...(role === "doctor" && { doctorProfile: doctorProfile || undefined }),
  });

  res.status(200).json({
    success: true,
    message:
      role === "doctor"
        ? "Doctor created successfully"
        : "Staff member created successfully",
    data: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

const APPOINTMENT_STATUSES = [
  "pending",
  "arrived",
  "completed",
  "cancelled",
  "no-show",
];

// Default export window: the last 30 clinic days (inclusive of today).
const DEFAULT_EXPORT_DAYS = 30;

const csvFilename = (prefix: string): string =>
  `reperto-${prefix}-${formatInTimeZone(new Date(), CLINIC_TIMEZONE, "yyyyMMdd")}.csv`;

// Appointments CSV for a date range (default: last 30 clinic days), with an
// optional status filter. Data-only export — no PDFs.
export const exportAppointmentsCsv = async (req: Request, res: Response) => {
  const { from, to, status } = req.query;

  if (status !== undefined && !APPOINTMENT_STATUSES.includes(String(status))) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid status filter", data: null });
  }

  const fromDate =
    typeof from === "string" && from ? parseDateAnchor(from) : undefined;
  if (typeof from === "string" && from && !fromDate) {
    return res.status(400).json({
      success: false,
      message: "Invalid start date (use YYYY-MM-DD)",
      data: null,
    });
  }
  const toDate =
    typeof to === "string" && to ? parseDateAnchor(to) : undefined;
  if (typeof to === "string" && to && !toDate) {
    return res.status(400).json({
      success: false,
      message: "Invalid end date (use YYYY-MM-DD)",
      data: null,
    });
  }

  const today = getClinicTodayAnchor();
  const gte =
    fromDate ?? new Date(today.getTime() - (DEFAULT_EXPORT_DAYS - 1) * DAY_MS);
  // End-of-window is exclusive: one clinic anchor after `to` (or today).
  const lt = toDate
    ? new Date(toDate.getTime() + DAY_MS)
    : new Date(today.getTime() + DAY_MS);
  if (gte.getTime() >= lt.getTime()) {
    return res.status(400).json({
      success: false,
      message: "Start date must be before end date",
      data: null,
    });
  }

  const query: Record<string, unknown> = {
    appointmentDate: { $gte: gte, $lt: lt },
  };
  if (status !== undefined) query.status = String(status);

  const appointments = await Appointment.find(query)
    .populate("patientId", "name phone")
    .populate("doctorId", "name")
    .populate("bookedBy", "name")
    .sort({ appointmentDate: 1, timeSlot: 1 })
    .lean();

  const header = [
    "Date",
    "Time",
    "Duration (min)",
    "Doctor",
    "Patient",
    "Patient Phone",
    "Status",
    "Type",
    "Primary Complaint",
    "Cancellation Reason",
    "Booked By",
  ];
  const rows = appointments.map((apt) => {
    const patient = apt.patientId as any;
    const doctor = apt.doctorId as any;
    const bookedBy = apt.bookedBy as any;
    return [
      formatInTimeZone(apt.appointmentDate, CLINIC_TIMEZONE, "yyyy-MM-dd"),
      apt.timeSlot,
      apt.durationInMinutes,
      doctor?.name ?? "",
      patient?.name ?? "",
      patient?.phone ?? "",
      apt.status,
      apt.consultationType,
      apt.intakeDetails?.primaryComplaint ?? "",
      apt.cancellationReason ?? "",
      bookedBy?.name ?? "",
    ];
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${csvFilename("appointments")}"`,
  );
  res.send(toCsv([header, ...rows]));
};

// Patients CSV: every patient account (self + managed profiles) with
// contact and clinical basics. Data-only export — no PDFs.
export const exportPatientsCsv = async (req: Request, res: Response) => {
  const patients = await User.find({ role: "patient" })
    .select(
      "name email phone gender dateOfBirth bloodGroup accountType isActive createdAt",
    )
    .sort({ createdAt: -1 })
    .lean();

  const header = [
    "Name",
    "Email",
    "Phone",
    "Gender",
    "Date of Birth",
    "Blood Group",
    "Account",
    "Registered At",
    "Status",
  ];
  const rows = patients.map((p) => [
    p.name,
    p.email ?? "",
    p.phone ?? "",
    p.gender,
    formatInTimeZone(p.dateOfBirth, CLINIC_TIMEZONE, "yyyy-MM-dd"),
    p.bloodGroup ?? "",
    p.accountType === "dependent" ? "Managed profile" : "Self",
    formatInTimeZone((p as any).createdAt, CLINIC_TIMEZONE, "yyyy-MM-dd"),
    p.isActive ? "Active" : "Inactive",
  ]);

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${csvFilename("patients")}"`,
  );
  res.send(toCsv([header, ...rows]));
};

// ---- Clinic settings & date blockouts ----

const blockoutPayload = (doc: {
  date: Date;
  allDay: boolean;
  slots: string[];
  reason?: string;
}) => ({
  date: formatInTimeZone(doc.date, CLINIC_TIMEZONE, "yyyy-MM-dd"),
  allDay: doc.allDay,
  slots: doc.slots,
  reason: doc.reason ?? "",
});

/**
 * Save the whole clinic settings document. The route validates the body with
 * clinicSettingsSchema; here we only normalize each day's slots (dedupe +
 * sort) and upsert the singleton document.
 */
export const updateClinicSettings = async (req: Request, res: Response) => {
  const {
    clinicName,
    address,
    phone,
    email,
    about,
    cancellationWindowMinutes,
    hours,
  } = req.body;

  const normalized = {
    clinicName,
    address,
    phone,
    email: email ?? "",
    about: about ?? "",
    cancellationWindowMinutes,
    hours: hours.map(
      (h: { day: number; isOpen: boolean; slots: string[] }) => ({
        day: h.day,
        isOpen: h.isOpen,
        slots: Array.from(new Set((h.slots ?? []).map((s) => s.trim()))).sort(),
      }),
    ),
  };

  const doc = await ClinicSettings.findOneAndUpdate({}, normalized, {
    upsert: true,
    returnDocument: "after",
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "Clinic settings saved",
    data: doc.toObject(),
  });
};

/** Clinic-wide date blockouts, optional from/to (YYYY-MM-DD) range. */
export const getClinicBlockouts = async (req: Request, res: Response) => {
  const { from, to } = req.query;
  const filter: { date?: { $gte?: Date; $lte?: Date } } = {};
  if (from !== undefined) {
    const fromDate = parseDateAnchor(String(from));
    if (!fromDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid from date (use YYYY-MM-DD)",
        data: null,
      });
    }
    filter.date = { ...(filter.date ?? {}), $gte: fromDate };
  }
  if (to !== undefined) {
    const toDate = parseDateAnchor(String(to));
    if (!toDate) {
      return res.status(400).json({
        success: false,
        message: "Invalid to date (use YYYY-MM-DD)",
        data: null,
      });
    }
    filter.date = { ...(filter.date ?? {}), $lte: toDate };
  }

  const blockouts = await ClinicBlockout.find(filter).sort({ date: 1 }).lean();

  res.status(200).json({
    success: true,
    message: "Clinic blockouts",
    data: blockouts.map(blockoutPayload),
  });
};

/** Create or overwrite the blockout for one clinic day. */
export const saveClinicBlockout = async (req: Request, res: Response) => {
  const { date, allDay, slots, reason } = req.body;

  const selectedDate = parseDateAnchor(String(date));
  if (!selectedDate) {
    return res.status(400).json({
      success: false,
      message: "Invalid date (use YYYY-MM-DD)",
      data: null,
    });
  }
  if (selectedDate.getTime() < getClinicTodayAnchor().getTime()) {
    return res.status(400).json({
      success: false,
      message: "Cannot block a date in the past",
      data: null,
    });
  }

  const normalizedSlots = allDay
    ? []
    : Array.from(new Set((slots ?? []).map((s: string) => s.trim()))).sort();

  const doc = await ClinicBlockout.findOneAndUpdate(
    { date: selectedDate },
    {
      date: selectedDate,
      allDay: Boolean(allDay),
      slots: normalizedSlots,
      reason: reason ?? "",
    },
    { upsert: true, returnDocument: "after", runValidators: true },
  );

  res.status(200).json({
    success: true,
    message: allDay
      ? "Clinic marked unavailable for this date"
      : "Slots blocked for this date",
    data: blockoutPayload(doc),
  });
};

/** Remove a blockout by clinic date (YYYY-MM-DD in the URL). */
export const deleteClinicBlockout = async (req: Request, res: Response) => {
  const { date } = req.params as { date: string };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      success: false,
      message: "Invalid date format (use YYYY-MM-DD)",
      data: null,
    });
  }

  const selectedDate = parseDateAnchor(date);
  if (!selectedDate) {
    return res.status(400).json({
      success: false,
      message: "Invalid date (use YYYY-MM-DD)",
      data: null,
    });
  }

  const result = await ClinicBlockout.deleteOne({ date: selectedDate });

  if (result.deletedCount === 0) {
    return res.status(404).json({
      success: false,
      message: "No blockout found for that date",
      data: null,
    });
  }

  res.status(200).json({ success: true, message: "Blockout removed", data: null });
};