import mongoose, { Schema, Document } from "mongoose";

export interface IReview extends Document {
  patientId: mongoose.Types.ObjectId;
  doctorId: mongoose.Types.ObjectId;
  rating: number;
  comment?: string;
}

const ReviewSchema: Schema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 1000, default: "" },
  },
  { timestamps: true },
);

// One review per patient-doctor pair; upserting edits the review in place.
ReviewSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });
// Doctor-detail listing order + doctor stats aggregation.
ReviewSchema.index({ doctorId: 1, createdAt: -1 });

export default mongoose.model<IReview>("Review", ReviewSchema);