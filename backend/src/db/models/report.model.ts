import mongoose, { Schema, Document } from "mongoose";

export type ReportCategory = "lab" | "imaging" | "test" | "other";

export interface IReportFile {
  /** Direct CDN link, set for Cloudinary-hosted files (images). */
  url?: string;
  /** Cloudinary public id, when the asset lives in Cloudinary. */
  publicId?: string;
  /** GridFS id, when the bytes are stored in MongoDB (PDFs). */
  storageId?: string;
  /** "cloudinary" | "gridfs" — decides which of the above is populated. */
  storage?: "cloudinary" | "gridfs";
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
    // Either a Cloudinary CDN url + publicId, or a GridFS storageId.
    url: { type: String },
    publicId: { type: String },
    storageId: { type: String },
    storage: { type: String, enum: ["cloudinary", "gridfs"], default: "cloudinary" },
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    resourceType: { type: String, default: "image" },
  },
  { _id: false },
);

// Downloads resolve a file by its report + index, so index lookups on the
// embedded files array need to be fast.
reportFileSchema.index({ storageId: 1 });

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