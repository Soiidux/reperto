import { Request, Response } from "express";
import Appointment from "../db/models/appointment.model";
import User from "../db/models/user.model";
import Leave from "../db/models/leave.model";
import { MASTER_SLOTS } from "../constants/slots";
import { ApiError } from "../errors";

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

  const doctor = await User.findOne({ _id: doctorId, role: "doctor" });
  if (!doctor) {
    const doctorNotFoundResponse: ApiResponse<null> = {
      success: false,
      message: "Selected doctor not found",
      data: null,
    };
    return res.status(404).json(doctorNotFoundResponse);
  }

  const [year, month, day] = appointmentDate.split("-").map(Number);
  const selectedDate = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selectedDate < today) {
    const pastDateResponse: ApiResponse<null> = {
      success: false,
      message: "Selected date cannot be in the past",
      data: null,
    };
    return res.status(400).json(pastDateResponse);
  }

  const alreadyBookedToday = await Appointment.findOne({
    patientId: req.user.id,
    appointmentDate: selectedDate,
    status: { $ne: "cancelled" },
  });
  if (alreadyBookedToday) {
    const alreadyBookedTodayResponse: ApiResponse<null> = {
      success: false,
      message: "You have already booked an appointment for today",
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

  const newAppointment = new Appointment({
    patientId: req.user.id,
    doctorId,
    appointmentDate: selectedDate,
    timeSlot,
    durationInMinutes,
    intakeDetails,
    consultationType: consultationType || "Initial",
    status: "pending",
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
    .sort({ appointmentDate: -1, timeSlot: 1 });

  if (!appointment) {
    return res
      .status(404)
      .json({ success: false, message: "Appointment not found", data: null });
  }

  const isPatient = req.user.role === "patient" && appointment.patientId.toString() !== req.user.id;
  const isDoctor = req.user.role === "doctor" && appointment.doctorId.toString() !== req.user.id;
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
  // 1. Get the current time specifically in India Timezone
  const indiaTime = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );

  // 2. Create the anchor using India's current Day, Month, and Year
  const todayAnchor = new Date(
    Date.UTC(
      indiaTime.getFullYear(),
      indiaTime.getMonth(),
      indiaTime.getDate(),
    ),
  );

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
    const now = new Date();
    const selectedDate = new Date(appointment.appointmentDate);
    const isToday =
      selectedDate.getUTCDate() === now.getUTCDate() &&
      selectedDate.getUTCMonth() === now.getUTCMonth() &&
      selectedDate.getUTCFullYear() === now.getUTCFullYear();
    if (isPatient && isToday) {
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
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

export const getAvailableSlots = async (req: Request, res: Response) => {
  const { doctorId, date, durationInMinutes = 15 } = req.query;
  const duration = Number(durationInMinutes);

  const [year, month, day] = (date as string).split("-").map(Number);
  const selectedDate = new Date(Date.UTC(year, month - 1, day));
  const now = new Date(); // Current time

  //All blocked slots
  const blocks = await Leave.find({
    doctorId: doctorId as string,
    startingDate: { $lte: selectedDate },
    $or: [
      { endingDate: { $gte: selectedDate } },
      { endingDate: { $exists: false } },
      { endingDate: null },
    ],
  });

  if (blocks.some((b) => b.type === "full-day")) {
    const fullDayLeaveResponse: ApiResponse<null> = {
      success: true,
      message: "Doctor is on leave",
      data: null,
    };
    return res.json(fullDayLeaveResponse);
  }
  // 1. Get all booked appointments for the day (including cancelled - cancelled slots should be freed up)
  // @ts-ignore
  const bookings = await Appointment.find({
    doctorId: doctorId as string,
    appointmentDate: selectedDate,
    status: { $ne: "cancelled" },
  });

  // 2. Map bookings to their numeric start and end times
  const busyPeriods = bookings.map((booking) => {
    const start = timeToMinutes(booking.timeSlot);
    return { start, end: start + Number(booking.durationInMinutes) };
  });

  // 3. Check each Master Slot to see if it's a valid starting point
  const availableSlots = MASTER_SLOTS.filter((slot) => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + duration;

    const isToday =
      selectedDate.getUTCDate() === now.getUTCDate() &&
      selectedDate.getUTCMonth() === now.getUTCMonth() &&
      selectedDate.getUTCFullYear() === now.getUTCFullYear();

    if (isToday) {
      const totalMinutesNow = now.getHours() * 60 + now.getMinutes();
      if (slotStart < totalMinutesNow + 15) return false;
    }

    const isBlockedByLeave = blocks.some((block) => {
      const currentDate = selectedDate.getTime();
      const startDate = block.startingDate.getTime();
      const endDate = block.endingDate
        ? block.endingDate.getTime()
        : startDate;

      // CASE 1: Single Day Partial Leave (Starts and Ends Today)
      if (currentDate === startDate && currentDate === endDate) {
        const bStart = block.startingTime
          ? timeToMinutes(block.startingTime)
          : 0;
        const bEnd = block.endingTime
          ? timeToMinutes(block.endingTime)
          : 1440;
        return slotStart < bEnd && slotEnd > bStart;
      }

      // CASE 2: Starting Day of multiday leave
      if (currentDate === startDate) {
        const blockStart = block.startingTime
          ? timeToMinutes(block.startingTime)
          : 0;
        return slotStart < 1440 && slotEnd > blockStart;
      }
      // CASE 3: Ending Day of multiday leave
      if (block.endingDate && currentDate === endDate) {
        const blockEnd = block.endingTime
          ? timeToMinutes(block.endingTime)
          : 1440;
        return slotStart < blockEnd && slotEnd > 0;
      }
      // CASE 4: Multiday leave in the middle
      if (currentDate > startDate && currentDate < endDate) return true;

      return false;
    });

    if (isBlockedByLeave) return false;

    // Check if this new "potential" block overlaps with ANY busy period
    const isOverlapping = busyPeriods.some((busy) => {
      return slotStart < busy.end && slotEnd > busy.start;
    });

    return !isOverlapping;
  });

  const availableSlotsResponse: ApiResponse<typeof availableSlots> = {
    success: true,
    message: "Available slots retrieved successfully",
    data: availableSlots,
  };
  res.json(availableSlotsResponse);
};
