import mongoose, { Schema, Document } from "mongoose";

export const INVOICE_STATUSES = ["issued", "paid", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface IInvoice extends Document {
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  consultationId: mongoose.Types.ObjectId;
  appointmentId: mongoose.Types.ObjectId;
  invoiceNumber: string;
  amount: number;
  status: InvoiceStatus;
  doctorName: string;
  patientName: string;
  consultationType: "Initial" | "Follow-up" | "Acute";
  consultationDate: Date;
}

const InvoiceSchema: Schema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    consultationId: {
      type: Schema.Types.ObjectId,
      ref: "Consultation",
      required: true,
      unique: true,
    },
    appointmentId: { type: Schema.Types.ObjectId, ref: "Appointment", required: true },
    invoiceNumber: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: INVOICE_STATUSES, default: "issued", required: true },
    doctorName: { type: String, required: true },
    patientName: { type: String, required: true },
    consultationType: { type: String, enum: ["Initial", "Follow-up", "Acute"], required: true },
    consultationDate: { type: Date, required: true },
  },
  { timestamps: true },
);

// Fast per-patient and per-doctor listings.
InvoiceSchema.index({ patientId: 1, createdAt: -1 });
InvoiceSchema.index({ doctorId: 1, createdAt: -1 });

export default mongoose.model<IInvoice>("Invoice", InvoiceSchema);