import mongoose, { Schema, Document } from 'mongoose';


interface ILeave extends Document {
  doctorId: mongoose.Types.ObjectId;
  type: 'full-day' | 'half-day' | 'emergency';
  startingDate: Date;
  startingTime?: string;
  endingDate?: Date;
  endingTime?: string;
  reason: string;
}


const LeaveSchema: Schema = new Schema({
  doctorId: { type: mongoose.Types.ObjectId, required: true },
  type: { type: String, enum: ['full-day', 'half-day', 'emergency'], required: true },
  startingDate: { type: Date, required: true },
  startingTime: { type: String, required: false },
  endingDate: { type: Date, required: false },
  endingTime: { type: String, required: false },
  reason: { type: String, required: true, default: "Personal Leave" },
});

LeaveSchema.index({ doctorId: 1, startingDate: 1, endingDate: 1 }, { unique: true });

export default mongoose.model<ILeave>('Leave', LeaveSchema);