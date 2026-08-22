import { Request, Response } from "express";
import mongoose from "mongoose";
import Appointment from "../db/models/appointment.model";
import User from "../db/models/user.model";
import Leave from "../db/models/leave.model";
import { MASTER_SLOTS } from "../constants/slots";
import { ApiError } from "../errors";
import {
  getClinicTodayAnchor,
  isClinicToday,
  getClinicNowMinutes,
  parseDateAnchor,
} from "../utils/clinicDate";

const timeToMinutes = (timeStr: string) => {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

const forbiddenResponse: ApiResponse<null> = {
  success: false,
  message: "You are not authorized to view this.",
  data: null,
};

// Shared availability helpers --------------------------------------------

const getDayContext = async (
  doctorId: string,
  selectedDate: Date,
  excludeAppointmentId?: string,
) => {
  const blocks = await Leave.find({
    doctorId,
    startingDate: { $lte: selectedDate },
    $or: [
      { endingDate: { $gte: selectedDate } },
      { endingDate: { $exists: false } },
      { endingDate: null },
    ],
  });
  // Cancelled appointments free their slot back up
  const bookings = await Appointment.find({
    doctorId,
    appointmentDate: selectedDate,
    status: { $ne: "cancelled" },
    ...(excludeAppointmentId ? { _id: { $ne: excludeAppointmentId } } : {}),
  });
  return { blocks, bookings };
};

const isSlotBlockedByLeave = (
  blocks: any[],
  selectedDate: Date,
  slotStart: number,
  slotEnd: number,
): boolean => {
  return blocks.some((block) => {
    const currentDate = selectedDate.getTime();
    const startDate = block.startingDate.getTime();
    const endDate = block.endingDate ? block.endingDate.getTime() : startDate;

    // CASE 1: Single Day Partial Leave (Starts and Ends Today)
    if (currentDate === startDate && currentDate === endDate) {
      const bStart = block.startingTime ? timeToMinutes(block.startingTime) : 0;
      const bEnd = block.endingTime ? timeToMinutes(block.endingTime) : 1440;
      return slotStart < bEnd && slotEnd > bStart;
    }

    // CASE 2: Starting Day of multiday leave
    if (currentDate === startDate) {
      const blockStart = block.startingTime ? timeToMinutes(block.startingTime) : 0;
      return slotStart < 1440 && slotEnd > blockStart;
    }
    // CASE 3: Ending Day of multiday leave
    if (block.endingDate && currentDate === endDate) {
      const blockEnd = block.endingTime ? timeToMinutes(block.endingTime) : 1440;
      return slotStart < blockEnd && slotEnd > 0;
    }
    // CASE 4: Multiday leave in the middle
    if (currentDate > startDate && currentDate < endDate) return true;

    return false;
  });
};

const isSlotOverlappingBookings = (
  bookings: { timeSlot: string; durationInMinutes: number }[],
  slotStart: number,
  slotEnd: number,
): boolean => {
  return bookings.some((booking) => {
    const start = timeToMinutes(booking.timeSlot);
    const end = start + Number(booking.durationInMinutes);
    return slotStart < end && slotEnd > start;
  });
};

/**
 * Server-side enforcement of doctor availability at booking time.
 * Availability shown by getAvailableSlots and enforced here share
 * the same logic, so a blocked slot can never be booked.
 */
const assertSlotAvailable = async (
  doctorId: string,
  selectedDate: Date,
  timeSlot: string,
  durationInMinutes: number,
  excludeAppointmentId?: string,
): Promise<void> => {
  const { blocks, bookings } = await getDayContext(
    doctorId,
    selectedDate,
    excludeAppointmentId,
  );

  if (blocks.some((b) => b.type === "full-day")) {
    throw new ApiError(400, "Doctor is on leave on the selected date");
  }

  const slotStart = timeToMinutes(timeSlot);
  const slotEnd = slotStart + durationInMinutes;

  if (isSlotBlockedByLeave(blocks, selectedDate, slotStart, slotEnd)) {
    throw new ApiError(400, "Doctor is unavailable during the selected time");
  }

  if (isSlotOverlappingBookings(bookings, slotStart, slotEnd)) {
    throw new ApiError(400, "Selected time overlaps with an existing appointment");
  }
};

type PopulateSpec = { path: string; select: string };

// Legal status transitions; terminal states allow nothing
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["arrived", "completed", "cancelled", "no-show"],
  arrived: ["completed", "cancelled", "no-show"],
  completed: [],
  cancelled: [],
  "no-show": [],
};

// Role-aware scope: patients see their own, doctors see theirs,
// staff/admin can view everything with both sides populated.
const getAppointmentScope = (req: Request): { query: Record<string, any>; populates: PopulateSpec[] } => {
  const role = req.user.role;
  if (role === "patient") {
    return {
      query: { patientId: req.user.id },
      populates: [{ path: "doctorId", select: "name profileImageUrl" }],
    };
  }
  if (role === "doctor") {
    return {
      query: { doctorId: req.user.id },
      populates: [
        { path: "patientId", select: "name profileImageUrl gender dateOfBirth" },
      ],
    };
  }
  return {
    query: {},
    populates: [
      { path: "patientId", select: "name profileImageUrl gender dateOfBirth" },
      { path: "doctorId", select: "name profileImageUrl" },
      { path: "bookedBy", select: "name" },
    ],
  };
};

const applyPopulates = (query: any, populates: PopulateSpec[]) => {
  let q = query;
  for (const spec of populates) {
    q = q.populate(spec.path, spec.select);
  }
  return q;
};

export const bookAppointment = async (req: Request, res: Response) => {
  const {
    doctorId,
    appointmentDate,
    timeSlot,
    intakeDetails,
    consultationType,
    durationInMinutes,
    patientId: requestedPatientId,
  } = req.body;

  if (
    !doctorId ||
    !appointmentDate ||
    !timeSlot ||
    !intakeDetails ||
    !consultationType ||
    !durationInMinutes
  ) {
    const missingFieldsResponse: ApiResponse<null> = {
      success: false,
      message: "Please provide all required fields",
      data: null,
    };
    return res.status(400).json(missingFieldsResponse);
  }

  // Resolve who the appointment is for: patients book for themselves;
  // staff/admin book on behalf of a patient and are recorded in bookedBy.
  let targetPatientId: string;
  let bookedBy: string | undefined;
  const isStaffBooking = req.user.role === "staff" || req.user.role === "admin";

  if (isStaffBooking) {
    if (!requestedPatientId) {
      throw new ApiError(400, "Select a patient for this appointment");
    }
    if (!mongoose.isValidObjectId(requestedPatientId)) {
      throw new ApiError(400, "Invalid patient id");
    }
    const patient = await User.findOne({
      _id: requestedPatientId,
      role: "patient",
      isActive: true,
    });
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found or inactive", data: null });
    }
    targetPatientId = String(patient._id);
    bookedBy = req.user.id;
  } else {
    if (requestedPatientId && requestedPatientId !== req.user.id) {
      return res.status(403).json(forbiddenResponse);
    }
    targetPatientId = req.user.id;
  }

  const doctor = await User.findOne({
    _id: doctorId,
    role: "doctor",
    isActive: true,
  });
  if (!doctor) {
    const doctorNotFoundResponse: ApiResponse<null> = {
      success: false,
      message: "Selected doctor not found",
      data: null,
    };
    return res.status(404).json(doctorNotFoundResponse);
  }

    const selectedDate = parseDateAnchor(appointmentDate);
    if (!selectedDate) {
      throw new ApiError(400, "Invalid appointment date format");
    }
    if (selectedDate < getClinicTodayAnchor()) {
      const pastDateResponse: ApiResponse<null> = {
        success: false,
        message: "Selected date cannot be in the past",
        data: null,
      };
      return res.status(400).json(pastDateResponse);
    }

  // A patient can hold only one live booking at a time, on any date.
  // Completed/cancelled/no-show appointments don't block new bookings.
  const activeBooking = await Appointment.findOne({
    patientId: targetPatientId,
    status: { $in: ["pending", "arrived"] },
  });
  if (activeBooking) {
    return res.status(400).json({
      success: false,
      message: isStaffBooking
        ? "This patient already has an upcoming appointment"
        : "You already have an upcoming appointment; cancel or complete it before booking another",
      data: null,
    });
  }

  // Even past visits count against rebooking the same day
  const alreadyBookedToday = await Appointment.findOne({
    patientId: targetPatientId,
    appointmentDate: selectedDate,
    status: { $nin: ["cancelled", "pending", "arrived"] },
  });
  if (alreadyBookedToday) {
    const alreadyBookedTodayResponse: ApiResponse<null> = {
      success: false,
      message: isStaffBooking
        ? "This patient already has an appointment on the selected date"
        : "You have already booked an appointment for today",
      data: null,
    };
    return res.status(400).json(alreadyBookedTodayResponse);
  }

  const existingAppointment = await Appointment.findOne({
    doctorId,
    appointmentDate: selectedDate,
    timeSlot,
    status: { $ne: "cancelled" },
  });
    if (existingAppointment) {
      const existingAppointmentResponse: ApiResponse<null> = {
        success: false,
        message: "Selected time slot is already booked",
        data: null,
      };
      return res.status(400).json(existingAppointmentResponse);
    }

    // Enforce doctor leave and overlap rules server-side
    await assertSlotAvailable(
      doctorId,
      selectedDate,
      timeSlot,
      Number(durationInMinutes),
    );

  const newAppointment = new Appointment({
    patientId: targetPatientId,
    doctorId,
    appointmentDate: selectedDate,
    timeSlot,
    durationInMinutes,
    intakeDetails,
    consultationType: consultationType || "Initial",
    status: "pending",
    ...(bookedBy ? { bookedBy } : {}),
  });

  await newAppointment.save().catch((error: any) => {
    // Handle the Mongo Unique Index error specifically if it bypasses our check
    if (error?.code === 11000) {
      throw new ApiError(409, "Conflict: This slot was just taken by someone else!");
    }
    throw error;
  });
  const response: ApiResponse<typeof newAppointment> = {
    success: true,
    message: "Appointment booked successfully",
    data: newAppointment,
  };
  res.status(201).json(response);
};

export const getAppointments = async (req: Request, res: Response) => {
  const { query, populates } = getAppointmentScope(req);

  const { status } = req.query;
  if (status && status !== "all") {
    query.status = status;
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 0;
  const skip = (page - 1) * limit;

  let appointmentQuery = applyPopulates(Appointment.find(query), populates)
    .sort({ appointmentDate: -1, createdAt: -1, timeSlot: 1 });

  const totalItems = await Appointment.countDocuments(query);
  if (limit > 0) appointmentQuery = appointmentQuery.skip(skip).limit(limit);

  const appointments = await appointmentQuery;
  const totalPages = Math.ceil(totalItems / Math.max(limit, 1));

  res.status(200).json({
    success: true,
    message: "All appointments",
    data: {
      count: appointments.length,
      appointments,
      pagination: {
        totalItems,
        currentPage: page,
        totalPages,
        hasNextPage: limit > 0 && page < totalPages,
        hasPrevPage: limit > 0 && page > 1,
      },
    },
  });
};

export const getAppointment = async (req: Request, res: Response) => {
  const { id } = req.params;

  const appointment = await Appointment.findOne({ _id: id })
    .populate("patientId", "name profileImageUrl gender dateOfBirth")
    .populate("doctorId", "name profileImageUrl")
    .populate("bookedBy", "name")
    .sort({ appointmentDate: -1, timeSlot: 1 });

  if (!appointment) {
    return res
      .status(404)
      .json({ success: false, message: "Appointment not found", data: null });
  }

  // patientId/doctorId are populated above; compare their ids, not the
  // documents themselves (a populated doc stringifies to "[object Object]")
  const patientId = String(
    (appointment.patientId as { _id?: unknown })?._id ?? appointment.patientId,
  );
  const doctorId = String(
    (appointment.doctorId as { _id?: unknown })?._id ?? appointment.doctorId,
  );
  const isPatient = req.user.role === "patient" && patientId !== req.user.id;
  const isDoctor = req.user.role === "doctor" && doctorId !== req.user.id;
  if (isPatient || isDoctor) {
    return res.status(403).json(forbiddenResponse);
  }

  const appointmentsResponse: ApiResponse<typeof appointment> = {
    success: true,
    message: "Appointment found",
    data: appointment,
  };
  res.status(200).json(appointmentsResponse);
};

export const getActiveAppointments = async (req: Request, res: Response) => {
  const { query, populates } = getAppointmentScope(req);

  query.status = { $nin: ["completed", "cancelled", "no-show"] };

  const appointments = await applyPopulates(Appointment.find(query), populates)
    .sort({ appointmentDate: -1, timeSlot: 1 });

  const appointmentsResponse: ApiResponse<{
    count: number;
    appointments: typeof appointments;
  }> = {
    success: true,
    message: "All appointments",
    data: {
      count: appointments.length,
      appointments: appointments,
    },
  };
  res.status(200).json(appointmentsResponse);
};

export const getArrivedPatients = async (req: any, res: Response) => {
  const { query, populates } = getAppointmentScope(req);

  query.status = "arrived";

  // Waiting-room boards only care about today's arrivals
  if (req.query.scope === "today") {
    query.appointmentDate = getClinicTodayAnchor();
  }

  const appointments = await applyPopulates(Appointment.find(query), populates)
    .sort({ appointmentDate: -1, timeSlot: 1 });

  const appointmentsResponse: ApiResponse<{
    count: number;
    appointments: typeof appointments;
  }> = {
    success: true,
    message: "Arrived appointments",
    data: {
      count: appointments.length,
      appointments: appointments,
    },
  };
  res.status(200).json(appointmentsResponse);
};

export const getTodaysAppointments = async (req: any, res: Response) => {
  // Anchor "today" to the clinic timezone, stored as UTC midnight
  const todayAnchor = getClinicTodayAnchor();

  const query: any = {
    appointmentDate: todayAnchor,
    status: { $ne: "cancelled" }, // Doctors usually don't want to see cancelled slots in their active queue
  };

  const role = req.user.role;
  if (role === "doctor") {
    query.doctorId = req.user.id;
  } else if (role === "patient") {
    query.patientId = req.user.id;
  }

  const populates: PopulateSpec[] =
    role === "patient"
      ? [{ path: "doctorId", select: "name profileImageUrl gender dateOfBirth" }]
      : [{ path: "patientId", select: "name email phone profileImageUrl gender dateOfBirth" }];

  const appointments = await applyPopulates(Appointment.find(query), populates)
    .sort({ timeSlot: 1 }); // Sorted by time for the daily schedule

  const response: ApiResponse<{
    count: number;
    appointments: typeof appointments;
  }> = {
    success: true,
    message: "All appointments",
    data: { count: appointments.length, appointments },
  };
  res.status(200).json(response);
};

export const updateAppointmentStatus = async (req: any, res: Response) => {
  const { id } = req.params;
  const { status, cancellationReason } = req.body;

  // 1. Fetch the appointment
  const appointment = await Appointment.findById(id);

  if (!appointment) {
    return res
      .status(404)
      .json({ success: false, message: "Appointment not found", data: null });
  }
  // 2. Role-Based Permission Logic
  const isDoctor = req.user.role === "doctor";
  const isPatient = req.user.role === "patient";
  const isOwner = appointment.patientId.toString() === req.user.id;
  const isAssignedDoctor = appointment.doctorId.toString() === req.user.id;

  /**
   * PERMISSION RULES:
   * - Patients can ONLY 'cancel' their own appointments.
   * - Doctors can move status to 'arrived', 'completed', or 'cancelled'.
   */
  if (isPatient) {
    if (!isOwner) {
      return res.status(403).json(forbiddenResponse);
    }
    if (status !== "cancelled") {
      return res.status(403).json(forbiddenResponse);
    }
  }

  if (isDoctor && !isAssignedDoctor) {
    return res.status(403).json(forbiddenResponse);
  }

  // 3. Enforce the status workflow (e.g., no cancelling a completed appointment)
  const allowedTargets = ALLOWED_TRANSITIONS[appointment.status] ?? [];
  if (!allowedTargets.includes(status)) {
    return res.status(400).json({ success: false, message: `Cannot move a ${appointment.status} appointment to ${status}`, data: null });
  }

  // 4. Update the fields
  appointment.status = status;

  if (status === "cancelled") {
    const selectedDate = new Date(appointment.appointmentDate);
    if (isPatient && isClinicToday(selectedDate)) {
      const nowMinutes = getClinicNowMinutes();
      const timeSlotMinutes = timeToMinutes(appointment.timeSlot);

      const differenceInMinutes = timeSlotMinutes - nowMinutes;
      if (differenceInMinutes < 120 && differenceInMinutes > 0) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Cannot cancel appointment within 2 hours of the slot",
            data: null,
          });
      }
    }

    appointment.cancellationReason =
      cancellationReason && cancellationReason.length > 0 ? cancellationReason : "No reason provided";
  }

  await appointment.save();

  res.status(200).json({
    success: true,
    message: `Appointment status updated to ${status}`,
    data: appointment,
  });
};

export const rescheduleAppointment = async (req: any, res: Response) => {
  const { id } = req.params;
  const { appointmentDate, timeSlot } = req.body;

  const appointment = await Appointment.findById(id);
  if (!appointment) {
    return res
      .status(404)
      .json({ success: false, message: "Appointment not found", data: null });
  }

  // Same permission model as status updates: owner-patient,
  // assigned-doctor, or staff/admin.
  const isPatient = req.user.role === "patient";
  const isDoctor = req.user.role === "doctor";
  const isOwner = appointment.patientId.toString() === req.user.id;
  const isAssignedDoctor = appointment.doctorId.toString() === req.user.id;

  if (isPatient && !isOwner) {
    return res.status(403).json(forbiddenResponse);
  }
  if (isDoctor && !isAssignedDoctor) {
    return res.status(403).json(forbiddenResponse);
  }

  if (appointment.status !== "pending") {
    return res.status(400).json({
      success: false,
      message: `Cannot reschedule a ${appointment.status} appointment`,
      data: null,
    });
  }

  const selectedDate = parseDateAnchor(appointmentDate);
  if (!selectedDate) {
    throw new ApiError(400, "Invalid date format, expected YYYY-MM-DD");
  }
  if (selectedDate < getClinicTodayAnchor()) {
    return res.status(400).json({
      success: false,
      message: "Selected date cannot be in the past",
      data: null,
    });
  }

  const isUnchanged =
    appointment.appointmentDate.getTime() === selectedDate.getTime() &&
    appointment.timeSlot === timeSlot;
  if (isUnchanged) {
    const response: ApiResponse<typeof appointment> = {
      success: true,
      message: "Appointment rescheduled successfully",
      data: appointment,
    };
    return res.status(200).json(response);
  }

  // The patient cannot hold two appointments on the same day
  const conflictingPatientBooking = await Appointment.findOne({
    _id: { $ne: appointment._id },
    patientId: appointment.patientId,
    appointmentDate: selectedDate,
    status: { $ne: "cancelled" },
  });
  if (conflictingPatientBooking) {
    return res.status(400).json({
      success: false,
      message: "The patient already has an appointment on the selected date",
      data: null,
    });
  }

  await assertSlotAvailable(
    String(appointment.doctorId),
    selectedDate,
    timeSlot,
    Number(appointment.durationInMinutes),
    String(appointment._id),
  );

  appointment.appointmentDate = selectedDate;
  appointment.timeSlot = timeSlot;

  await appointment.save().catch((error: any) => {
    if (error?.code === 11000) {
      throw new ApiError(409, "Conflict: This slot was just taken by someone else!");
    }
    throw error;
  });

  const response: ApiResponse<typeof appointment> = {
    success: true,
    message: "Appointment rescheduled successfully",
    data: appointment,
  };
  res.status(200).json(response);
};

export const getAvailableSlots = async (req: Request, res: Response) => {
  const { doctorId, date, durationInMinutes = 15 } = req.query;

  if (!doctorId || typeof doctorId !== "string") {
    throw new ApiError(400, "doctorId query parameter is required");
  }
  if (!date || typeof date !== "string") {
    throw new ApiError(400, "date query parameter is required");
  }
  const selectedDate = parseDateAnchor(date);
  if (!selectedDate) {
    throw new ApiError(400, "Invalid date format, expected YYYY-MM-DD");
  }
  const duration = Number(durationInMinutes);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new ApiError(400, "Invalid duration");
  }

  const { blocks, bookings } = await getDayContext(doctorId, selectedDate);

  if (blocks.some((b) => b.type === "full-day")) {
    const fullDayLeaveResponse: ApiResponse<null> = {
      success: true,
      message: "Doctor is on leave",
      data: null,
    };
    return res.json(fullDayLeaveResponse);
  }

  // Check each Master Slot to see if it's a valid starting point
  const availableSlots = MASTER_SLOTS.filter((slot) => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + duration;

    if (isClinicToday(selectedDate)) {
      if (slotStart < getClinicNowMinutes() + 15) return false;
    }

    if (isSlotBlockedByLeave(blocks, selectedDate, slotStart, slotEnd)) {
      return false;
    }

    return !isSlotOverlappingBookings(bookings, slotStart, slotEnd);
  });

  const availableSlotsResponse: ApiResponse<typeof availableSlots> = {
    success: true,
    message: "Available slots retrieved successfully",
    data: availableSlots,
  };
  res.json(availableSlotsResponse);
};
