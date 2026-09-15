import mongoose, { Schema, Document } from 'mongoose';

const intakeDetailsSchema = new Schema({
  primaryComplaint: {
    type: String,
    required: [true, "Primary complaint is required"],
    maxLength: [500, "Primary complaint must be less than 500 characters"],
  },
  duration: {
    type: String,
    required: [true, "Duration is required"],
    default: ''
  },
  currentMedication: {
    type: String,
    default: ''
  },
  pastMedicalHistory: {
    type: String,
    default: ''
  },
}, { _id: false });


interface IAppointment extends Document{
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  appointmentDate: Date;
  timeSlot: string;
  durationInMinutes: number;
  status: 'pending' | 'arrived' | 'completed' | 'cancelled' | 'no-show';
  consultationType: 'Initial' | 'Follow-up' | 'Acute';
  intakeDetails: {
    primaryComplaint: string;
    duration: string;
    currentMedication: string;
    pastMedicalHistory: string;
  };
  cancellationReason?: string;
  bookedBy?: mongoose.Types.ObjectId;
  // Timestamp of the transactional reminder email sent the day before the
  // visit; null until the appointment is completed/cancelled (or reminded).
  reminderEmailAt?: Date | null;
  // Set by the leave-conflict resolver when a doctor's leave overlaps this
  // booking; patients pick a rescheduleSuggestions entry (or any free slot)
  // via the existing reschedule flow, which clears these fields.
  needsReschedule: boolean;
  rescheduleSuggestions: {
    date: Date;
    timeSlot: string;
  }[];
}

const AppointmentSchema = new Schema({
  patientId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  appointmentDate: { type: Date, required: true },
  timeSlot: { type: String, required: true },
  durationInMinutes: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'arrived', 'completed', 'cancelled', 'no-show'], required: true },
  consultationType: { type: String, enum: ['Initial', 'Follow-up', 'Acute'], required: true },
  intakeDetails: { type: intakeDetailsSchema, required: true },
  cancellationReason: { type: String, default: '' },
  // Set when staff/admin books on behalf of a patient; absent for self-booked
  bookedBy: { type: mongoose.Types.ObjectId, ref: 'User' },
  reminderEmailAt: { type: Date, default: null },
  needsReschedule: { type: Boolean, default: false },
  rescheduleSuggestions: [
    {
      _id: false,
      date: { type: Date, required: true },
      timeSlot: { type: String, required: true },
    },
  ],
}, { timestamps: true });

// COMPOUND INDEX: Prevents double-booking at the database level logic-wise
AppointmentSchema.index({ doctorId: 1, appointmentDate: 1, timeSlot: 1 }, {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "arrived", "completed", "no-show"] },
    },
  });
AppointmentSchema.index({ patientId: 1, status: 1 });

export default mongoose.model<IAppointment>('Appointment', AppointmentSchema);