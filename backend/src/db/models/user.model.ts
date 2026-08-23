import mongoose, { Schema, Document } from 'mongoose';

type UserRole = 'admin' | 'doctor' | 'staff' | 'patient';

// A "self" is a real login account; a "dependent" is a clinical record
// (child/spouse/parent) managed by guardians and never able to authenticate.
type AccountType = 'self' | 'dependent';

const RELATIONSHIPS = ['spouse', 'child', 'parent', 'sibling', 'other'] as const;
type Relationship = (typeof RELATIONSHIPS)[number];

const DoctorProfileSchema = new Schema({
  qualifications: [{ type: String, trim: true }],
  experienceYears: { type: Number, min: 0 },
  specializations: [{ type: String, trim: true }],
  languagesSpoken: [{ type: String, trim: true }],
  consultationFee: { type: Number, min: 0 },
}, { 
  _id: false // Prevents Mongoose from creating a separate _id for this sub-doc
});

export interface IUser extends Document {
  name: string;
  email?: string;
  password?: string;
  role: UserRole;
  phone?: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: Date;
  bloodGroup: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  profileImageUrl?: string;      // URL from Cloudinary
  isActive: boolean;
  accountType: AccountType;
  relationship?: Relationship;
  guardians?: mongoose.Types.ObjectId[];
  createdBy?: mongoose.Types.ObjectId;
  shareCode?: string;            // join code for co-guardians, dependents only
  doctorProfile?: {
      qualifications: string[];
      experienceYears: number;
      specializations: string[];
      languagesSpoken: string[];
      consultationFee: number;
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
    // Dependents (children etc.) have no inbox of their own
    required: function (this: IUser) {
      return this.accountType !== 'dependent';
    },
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    select: false,
    required: function (this: IUser) {
      return this.accountType !== 'dependent';
    },
  },
  role: {
    type: String,
    enum: ['admin', 'doctor', 'staff', 'patient'],
    default: 'patient',
  },
  phone: {
    type: String,
    required: function (this: IUser) {
      return this.accountType !== 'dependent';
    },
    trim: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: [true, 'Gender is required'],
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Date of birth is required'],
  },
  bloodGroup: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    required: function (this: IUser) {
      return this.accountType !== 'dependent';
    },
  },
  profileImageUrl: { type: String, default: '' },
  accountType: {
    type: String,
    enum: ['self', 'dependent'],
    default: 'self',
  },
  relationship: {
    type: String,
    enum: RELATIONSHIPS,
  },
  guardians: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  shareCode: {
    type: String,
    trim: true,
    uppercase: true,
  },
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


UserSchema.index({ role: 1, name: 1 });
// Email uniqueness applies to real accounts only; dependents share none.
// Replaces the former inline `unique: true` (full-collection index).
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { accountType: 'self' } },
);
// Join codes are unique among dependents; self accounts have none.
UserSchema.index(
  { shareCode: 1 },
  {
    unique: true,
    partialFilterExpression: { shareCode: { $exists: true, $type: 'string' } },
  },
);
// Guardian scope lookups ("which dependents can this user act for?")
UserSchema.index({ guardians: 1 });

export default mongoose.model<IUser>('User', UserSchema);