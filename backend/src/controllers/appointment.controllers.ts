import { Request, Response } from "express";
import Appointment from "../db/models/appointment.model";
import User from "../db/models/user.model";
import Leave from "../db/models/leave.model";
import { MASTER_SLOTS } from "../constants/slots";

const timeToMinutes = (timeStr: string) => {
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (modifier === "PM" && hours !== 12) hours += 12;
  if (modifier === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

export const bookAppointment = async (req: Request, res: Response) => {
  try {
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
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    const doctor = await User.findOne({ _id: doctorId, role: "doctor" });
    if (!doctor) {
      return res.status(404).json({ message: "Selected doctor not found" });
    }

    const [year, month, day] = appointmentDate.split("-").map(Number);
    const selectedDate = new Date(Date.UTC(year, month - 1, day));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return res
        .status(400)
        .json({ message: "Selected date cannot be in the past" });
    }

    const alreadyBookedToday = await Appointment.findOne({
      patientId: req.user.id,
      appointmentDate: selectedDate,
      status: { $ne: "cancelled" },
    });
    if (alreadyBookedToday) {
      return res
        .status(400)
        .json({ message: "You have already booked an appointment for today" });
    }

    const existingAppointment = await Appointment.findOne({
      doctorId,
      appointmentDate: selectedDate,
      timeSlot,
      status: { $ne: "cancelled" },
    });
    if (existingAppointment) {
      return res
        .status(400)
        .json({ message: "Selected time slot is already booked" });
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

    await newAppointment.save();
    res.status(201).json({
      message: "Appointment booked successfully",
      appointment: newAppointment,
    });
  } catch (error: any) {
    // Handle the Mongo Unique Index error specifically if it bypasses our check
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Conflict: This slot was just taken by someone else!",
      });
    }
    return res.status(500).json({ message: "Internal erver Error" });
  }
};

export const getAppointments = async (req: Request, res: Response) => {
  try {
    const isDoctor = req.user.role === "doctor";
    let query: any = isDoctor
      ? { doctorId: req.user.id }
      : { patientId: req.user.id };

    const appointments = await Appointment.find(query)
      .populate(
        isDoctor ? "patientId" : "doctorId",
        "name email phone profileImageUrl gender dateOfBirth",
      )
      .sort({ appointmentDate: -1, timeSlot: 1 });

    res.status(200).json({
      success: true,
      message: "All appointments",
      count: appointments.length,
      data: appointments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export const getTodaysAppointments = async (req: any, res: Response) => {
  try {
    const isDoctor = req.user.role === "doctor";

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

    // Apply role-based filtering
    if (isDoctor) {
      query.doctorId = req.user.id;
    } else {
      query.patientId = req.user.id;
    }

    const appointments = await Appointment.find(query)
      .populate(
        isDoctor ? "patientId" : "doctorId",
        "name email phone profileImageUrl gender dateOfBirth",
      )
      .sort({ timeSlot: 1 }); // Sorted by time for the daily schedule

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments,
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Error fetching today's queue", error: error.message });
  }
};

export const updateAppointmentStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { status, cancellationReason } = req.body;

    // 1. Fetch the appointment
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res
        .status(404)
        .json({ success: false, message: "Appointment not found" });
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
        return res
          .status(403)
          .json({ message: "Not authorized to modify this appointment" });
      }
      if (status !== "cancelled") {
        return res
          .status(400)
          .json({ message: "Patients can only cancel appointments" });
      }
    }

    if (isDoctor && !isAssignedDoctor) {
      return res.status(403).json({ message: "This is not your patient" });
    }

    // 3. Prevent logic errors (e.g., cancelling a completed appointment)
    if (appointment.status === "completed") {
      return res
        .status(400)
        .json({ message: "Cannot change status of a completed appointment" });
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
            .json({ message: "Cannot cancel appointment within 2 hours of the slot" });
        }
      }
      
      appointment.cancellationReason =
        cancellationReason || "No reason provided";
    }

    await appointment.save();

    res.status(200).json({
      success: true,
      message: `Appointment status updated to ${status}`,
      data: appointment,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export const getAvailableSlots = async (req: Request, res: Response) => {
  try {
    const { doctorId, date, durationInMinutes = 15 } = req.query;
    const duration = Number(durationInMinutes);

    const [year, month, day] = (date as string).split("-").map(Number);
    const selectedDate = new Date(Date.UTC(year, month - 1, day));
    const now = new Date(); // Current time
    
    //All blocked slots
    //@ts-ignore
    const blocks = await Leave.find({doctorId,
      startingDate: { $lte: selectedDate },
      $or: [
        { endingDate: { $gte: selectedDate } },
        { endingDate: { $exists: false } },
        { endingDate: null }
      ]
    });
    
    if (blocks.some(b => b.type === 'full-day')) {
          return res.json({ success: true, data: [], message: "Doctor is on leave" });
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
      })
      
      if (isBlockedByLeave) return false;
      
      // Check if this new "potential" block overlaps with ANY busy period
      const isOverlapping = busyPeriods.some((busy) => {
        return slotStart < busy.end && slotEnd > busy.start;
      });

      return !isOverlapping;
    });

    res.json({ success: true, data: availableSlots });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
