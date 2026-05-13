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
  isFollowUp: {
    type: Boolean,
    default: false
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
    isFollowUp: boolean;
  };
  cancellationReason?: string;
}

const AppointmentSchema = new Schema({
  patientId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  appointmentDate: { type: Date, required: true },
  timeSlot: { type: String, required: true ,default: 15},
  durationInMinutes: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'arrived', 'completed', 'cancelled','no-show'], required: true },
  consultationType: { type: String, enum: ['Initial', 'Follow-up', 'Acute'], required: true },
  intakeDetails: { type: intakeDetailsSchema, required: true },
  cancellationReason: { type: String, default: '' },
}, { timestamps: true });

// COMPOUND INDEX: Prevents double-booking at the database level logic-wise
AppointmentSchema.index({ doctorId: 1, appointmentDate: 1, timeSlot: 1 }, { unique: true });
AppointmentSchema.index({ patientId: 1, status: 1 });

export default mongoose.model<IAppointment>('Appointment', AppointmentSchema);