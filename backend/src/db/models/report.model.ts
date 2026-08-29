import mongoose, { Schema, Document } from "mongoose";

export type ReportCategory = "lab" | "imaging" | "test" | "other";

export interface IReportFile {
  url: string;
  publicId: string;
  name: string;
  mimeType: string;
  size: number;
  resourceType: string;
}

export interface IReport extends Document {
  patientId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  title: string;
  category: ReportCategory;
  description?: string;
  consultationId?: mongoose.Types.ObjectId;
  files: IReportFile[];
}

const reportFileSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    resourceType: { type: String, default: "image" },
  },
  { _id: false },
);

const ReportSchema = new Schema(
  {
    patientId: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    uploadedBy: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxLength: [150, "Title must be under 150 characters"],
    },
    category: {
      type: String,
      enum: ["lab", "imaging", "test", "other"],
      required: true,
    },
    description: { type: String, trim: true, maxLength: 2000, default: "" },
    // Optional link to the visit this report relates to (labs often arrive
    // after the consultation, so this is never required).
    consultationId: { type: mongoose.Types.ObjectId, ref: "Consultation" },
    files: { type: [reportFileSchema], required: true },
  },
  { timestamps: true },
);

ReportSchema.index({ patientId: 1, createdAt: -1 });

export default mongoose.model<IReport>("Report", ReportSchema);