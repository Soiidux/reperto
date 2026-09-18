import mongoose, { Schema, Document } from "mongoose";

/**
 * A temporary "intent to book" — the reservation behind movie-style booking.
 *
 * - Created when a patient taps a free time chip on the booking screen.
 * - While active, the slot it covers is treated as unavailable everywhere:
 *   booking enforcement (assertSlotAvailable), the free-slot picker and the
 *   slot-states endpoint all read the same availability helpers.
 * - Expiry is enforced three ways:
 *     1. A TTL index on expiresAt — MongoDB removes expired documents on its
 *        own (monitor tick ~60s), so abandoned holds free up with no cron job.
 *     2. A lazy check in bookFromHold — an expired hold can never convert.
 *     3. The frontend countdown, so no one stares at a stale reservation.
 */
interface IBookingHold extends Document {
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  appointmentDate: Date;
  timeSlot: string;
  durationInMinutes: number;
  consultationType: "Initial" | "Follow-up" | "Acute";
  expiresAt: Date;
  status: "active" | "converted" | "released";
  // Set when a guardian holds a slot for a dependent; absent for self-holds.
  bookedBy?: mongoose.Types.ObjectId;
}

const BookingHoldSchema = new Schema(
  {
    patientId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    appointmentDate: { type: Date, required: true },
    timeSlot: { type: String, required: true },
    durationInMinutes: { type: Number, required: true },
    consultationType: {
      type: String,
      enum: ["Initial", "Follow-up", "Acute"],
      required: true,
    },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "converted", "released"],
      default: "active",
    },
    // Set when a guardian holds for a dependent; mirrors Appointment.bookedBy
    bookedBy: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// One active hold per exact (doctor, day, start) slot: two patients can never
// both be holding the same chip, even if two requests arrive simultaneously.
BookingHoldSchema.index(
  { doctorId: 1, appointmentDate: 1, timeSlot: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);

// A patient holds at most one slot at a time (one reservation in flight).
BookingHoldSchema.index(
  { patientId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);

// TTL cleanup: expired holds are deleted by MongoDB itself (~60s tick).
BookingHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IBookingHold>("BookingHold", BookingHoldSchema);