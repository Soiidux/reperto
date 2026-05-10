import mongoose, { Schema, Document } from 'mongoose';

// 1. The Prescription Interface (What the patient takes home)
export interface IPrescription {
  remedyName: string;         // e.g., "Arnica Montana"
  potency: string | null;            // e.g., "30C", "200C", "Mother Tincture"
  dosage: string;             // e.g., "4 pills, 3 times a day"
  durationInDays: number;     // e.g., 15
}

// 2. The Main Consultation Interface
export interface IConsultation extends Document {
  appointmentId: mongoose.Types.ObjectId;
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  // Homeopathic Case Taking
  chiefComplaintDetails: {
    location: string;
    sensation: string;
    modalities: string;       // What makes it better or worse
    concomitants: string;     // Accompanying symptoms
  };
  
  pastMedicalHistory: string;
  
  physicalGenerals: {
    thermals: string;         // Chilly, Hot, Ambithermal
    thirst: string;
    appetiteAndCravings: string;
    sleepAndDreams: string;
  };

  mentalGenerals: string;     // Emotional state, fears, temperament
  
  // The final outcome of the visit
  diagnosis: string;          // e.g., "Acute Tonsillitis"
  prescriptions: IPrescription[]; // Array, in case multiple remedies are given
  doctorNotes: string;        // Private notes (not printed on prescription)
}

// 3. Mongoose Schema
const ConsultationSchema: Schema = new Schema({
  appointmentId: { type: mongoose.Types.ObjectId, ref: 'Appointment', required: true ,unique:true},
  patientId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
  chiefComplaintDetails: {
    location: { type: String, default: '' },
    sensation: { type: String, default: '' },
    modalities: { type: String, default: '' },
    concomitants: { type: String, default: '' }
  },

  physicalGenerals: {
    thermals: { type: String, default: '' },
    thirst: { type: String, default: '' },
    appetiteAndCravings: { type: String, default: '' },
    sleepAndDreams: { type: String, default: '' }
  },

  mentalGenerals: { type: String, default: '' },
  
  pastMedicalHistory: { type: String, default: '' },

  diagnosis: { type: String, default: '' },
  
  prescriptions: [{
    remedyName: { type: String, required: true },
    potency: { type: String, required: false ,default:null},
    dosage: { type: String, required: true },
    durationInDays: { type: Number, required: true }
  }],

  doctorNotes: { type: String, default: '' }

}, { timestamps: true });

export default mongoose.model<IConsultation>('Consultation', ConsultationSchema);