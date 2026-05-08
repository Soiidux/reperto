import mongoose, { Schema, Document } from 'mongoose';

type UserRole = 'admin' | 'doctor' | 'staff' | 'patient';

interface IUser extends Document{
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  isActive: boolean;
  doctorProfile?: {
      qualifications: string[];     // e.g., ['BHMS', 'MD (Materia Medica)']
      experienceYears: number;      // e.g., 10
      specializations: string[];    // e.g., ['Skin', 'Respiratory', 'Pediatrics']
      languagesSpoken: string[];    // e.g., ['English', 'Hindi']
      consultationFee: number;      // e.g., 500
      profileImageUrl: string;      // URL from Cloudinary
    };
}

const UserSchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    select: false,
  },
  role: {
    type: String,
    enum: ['admin', 'doctor', 'staff', 'patient'],
    default: 'patient',
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  doctorProfile: {
      qualifications: [{ type: String, trim: true }],
      experienceYears: { type: Number, min: 0 },
      specializations: [{ type: String, trim: true }],
      languagesSpoken: [{ type: String, trim: true }],
      consultationFee: { type: Number, min: 0 },
      profileImageUrl: { type: String, default: '' }
    }
}, {
  timestamps: true,
});

export default mongoose.model<IUser>('User', UserSchema);