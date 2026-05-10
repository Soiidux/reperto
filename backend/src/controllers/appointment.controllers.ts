import { Request, Response } from "express";
import Appointment from "../db/models/appointment.model";
import User from "../db/models/user.model";

export const bookAppointment = async (req: Request, res: Response) => {
  try {
    const { doctorId, appointmentDate, timeSlot, intakeDetails, consultationType } = req.body;
    
    if (!doctorId || !appointmentDate || !timeSlot || !intakeDetails || !consultationType) {
      return res.status(400).json({ message: "Please provide all required fields" });
    }
    
    const doctor = await User.findOne({ _id: doctorId, role: "doctor" });
    if (!doctor) {
      return res.status(404).json({ message: "Selected doctor not found" });
    }
    
    const selectedDate = new Date(appointmentDate);
    const today = new Date();
    if (selectedDate < today) {
      return res.status(400).json({ message: "Selected date cannot be in the past" });
    }
    
    const existingAppointment = await Appointment.findOne({ doctorId, appointmentDate: selectedDate, timeSlot, status: { $ne: 'cancelled' } });
    if (existingAppointment) {
      return res.status(400).json({ message: "Selected time slot is already booked" });
    }
    
    const newAppointment = new Appointment({
      patientId: req.user.id,
      doctorId,
      appointmentDate: selectedDate,
      timeSlot,
      intakeDetails,
      consultationType: consultationType || 'Initial',
      status: 'pending',
    });
    
    await newAppointment.save();
    res.status(201).json({ message: "Appointment booked successfully", appointment: newAppointment });
  } catch (error: any) {
    // Handle the Mongo Unique Index error specifically if it bypasses our check
    if (error.code === 11000) {
      return res.status(400).json({ message: "Conflict: This slot was just taken by someone else!" });
    }
    return res.status(500).json({ message: "Internal erver Error" });
  }
}

export const getAppointments = async (req: Request, res: Response) => {
  try {
    const isDoctor = req.user.role === 'doctor';
    let query : any = isDoctor ? { doctorId: req.user.id } : { patientId: req.user.id };
    
    const appointments = await Appointment.find(query)
      .populate(
        isDoctor ? 'patientId' : 'doctorId',
        'name email phone profileImageUrl gender dateOfBirth'
      ).sort({ appointmentDate: -1, timeSlot: 1 });
  
    res.status(200).json({
      success: true,
      message: "All appointments",
      count:appointments.length,
      data: appointments,
    })
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error', error: error instanceof Error ? error.message : String(error) });
  }
};

export const getTodaysAppointments = async (req: any, res: Response) => {
  try {
    const isDoctor = req.user.role === 'doctor';
    
    // Calculate Today's boundaries
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const query: any = {
      appointmentDate: { $gte: start, $lte: end },
      status: { $ne: 'cancelled' } // Doctors usually don't want to see cancelled slots in their active queue
    };

    // Apply role-based filtering
    if (isDoctor) {
      query.doctorId = req.user.id;
    } else {
      query.patientId = req.user.id;
    }

    const appointments = await Appointment.find(query)
      .populate(isDoctor ? 'patientId' : 'doctorId', 'name email phone profileImageUrl gender dateOfBirth')
      .sort({ timeSlot: 1 }); // Sorted by time for the daily schedule

    res.status(200).json({
      success: true,
      count: appointments.length,
      data: appointments
    });
  } catch (error: any) {
    res.status(500).json({ message: "Error fetching today's queue", error: error.message });
  }
};

export const updateAppointmentStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { status, cancellationReason } = req.body;

    // 1. Fetch the appointment
    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    // 2. Role-Based Permission Logic
    const isDoctor = req.user.role === 'doctor';
    const isPatient = req.user.role === 'patient';
    const isOwner = appointment.patientId.toString() === req.user.id;
    const isAssignedDoctor = appointment.doctorId.toString() === req.user.id;

    /**
     * PERMISSION RULES:
     * - Patients can ONLY 'cancel' their own appointments.
     * - Doctors can move status to 'arrived', 'completed', or 'cancelled'.
     */
    if (isPatient) {
      if (!isOwner) {
        return res.status(403).json({ message: "Not authorized to modify this appointment" });
      }
      if (status !== 'cancelled') {
        return res.status(400).json({ message: "Patients can only cancel appointments" });
      }
    }

    if (isDoctor && !isAssignedDoctor) {
      return res.status(403).json({ message: "This is not your patient" });
    }

    // 3. Prevent logic errors (e.g., cancelling a completed appointment)
    if (appointment.status === 'completed') {
      return res.status(400).json({ message: "Cannot change status of a completed appointment" });
    }

    // 4. Update the fields
    appointment.status = status;

    if (status === 'cancelled') {
      appointment.cancellationReason = cancellationReason || 'No reason provided';
    }

    await appointment.save();

    res.status(200).json({
      success: true,
      message: `Appointment status updated to ${status}`,
      data: appointment
    });

  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      message: "Internal server error", 
      error: error.message 
    });
  }
};