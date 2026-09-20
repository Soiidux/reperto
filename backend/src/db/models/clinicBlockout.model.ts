import mongoose, { Schema, Document } from "mongoose";

// A clinic-wide slot blockout for one specific date ("we're closed for the
// afternoon on the 25th", "power cut tomorrow"). Unlike doctor leave these
// apply to every doctor, and unlike the weekly hours they are one-offs.
// One document per date; when allDay is set the whole clinic day is shut.
interface IClinicBlockout extends Document {
  /** UTC-midnight anchor of the clinic day (same shape as appointment dates). */
  date: Date;
  allDay: boolean;
  /** 15-minute slot start times ("HH:mm") that are unavailable on this date. */
  slots: string[];
  reason?: string;
}

const ClinicBlockoutSchema = new Schema(
  {
    date: { type: Date, required: true },
    allDay: { type: Boolean, required: true, default: false },
    slots: { type: [String], default: [] },
    reason: { type: String, default: "" },
  },
  { timestamps: true },
);

// One blockout per clinic day — saving a new one for the same date overwrites.
ClinicBlockoutSchema.index({ date: 1 }, { unique: true });

export default mongoose.model<IClinicBlockout>("ClinicBlockout", ClinicBlockoutSchema);