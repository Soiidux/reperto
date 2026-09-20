import mongoose, { Schema, Document } from "mongoose";

// One day of clinic hours: a day index (0 = Sunday .. 6 = Saturday) plus the
// open/closed flag and the list of bookable 15-minute slot start times
// ("HH:mm", 24-hour) for that day. Empty slots + closed = the day is shut.
export interface ClinicDayHours {
  day: number;
  isOpen: boolean;
  slots: string[];
}

interface IClinicSettings extends Document {
  clinicName: string;
  address: string;
  phone: string;
  email: string;
  about: string;
  cancellationWindowMinutes: number;
  hours: ClinicDayHours[];
}

const clinicDayHoursSchema = new Schema(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    isOpen: { type: Boolean, required: true, default: false },
    slots: {
      type: [String],
      default: [],
      validate: {
        validator: (slots: string[]) => new Set(slots).size === slots.length,
        message: "Duplicate slot times are not allowed",
      },
    },
  },
  { _id: false },
);

// The clinic itself. A single document (the app mints it with sane defaults
// if it is ever missing), holding everything patients see about the practice
// plus the booking-policy knobs: cancellation window and per-day hours.
const ClinicSettingsSchema = new Schema(
  {
    clinicName: { type: String, default: "Reperto Homeopathic Clinic" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    about: { type: String, default: "" },
    cancellationWindowMinutes: { type: Number, default: 120 },
    hours: { type: [clinicDayHoursSchema], default: [] },
  },
  { timestamps: true },
);

export default mongoose.model<IClinicSettings>("ClinicSettings", ClinicSettingsSchema);