import mongoose, { Schema, Document } from 'mongoose';

type UserRole = 'admin' | 'doctor' | 'staff' | 'patient';

const DoctorProfileSchema = new Schema({
  qualifications: [{ type: String, trim: true }],
  experienceYears: { type: Number, min: 0 },
  specializations: [{ type: String, trim: true }],
  languagesSpoken: [{ type: String, trim: true }],
  consultationFee: { type: Number, min: 0 },
}, { 
  _id: false // Prevents Mongoose from creating a separate _id for this sub-doc
});

interface IUser extends Document{
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
  profileImageUrl?: string;      // URL from Cloudinary
  isActive: boolean;
  doctorProfile?: typeof DoctorProfileSchema;
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
  profileImageUrl: { type: String, default: '' },
  isActive: {
    type: Boolean,
    default: true,
  },
  doctorProfile: {
    type: DoctorProfileSchema,
    required: false,
    default: undefined,
  }
}, {
  timestamps: true,
});

export default mongoose.model<IUser>('User', UserSchema);