import mongoose, { Schema, Document } from "mongoose";

export interface IInvoiceCounter extends Document {
  year: number;
  seq: number;
}

const InvoiceCounterSchema: Schema = new Schema({
  year: { type: Number, required: true },
  seq: { type: Number, required: true, default: 0 },
});

InvoiceCounterSchema.index({ year: 1 }, { unique: true });

export default mongoose.model<IInvoiceCounter>("InvoiceCounter", InvoiceCounterSchema);