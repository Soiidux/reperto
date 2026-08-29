import mongoose, { Schema, Document } from "mongoose";

export const EMAIL_TOKEN_PURPOSES = ["verify-email", "reset-password"] as const;
export type EmailTokenPurpose = (typeof EMAIL_TOKEN_PURPOSES)[number];

export interface IEmailToken extends Document {
  userId: mongoose.Types.ObjectId;
  purpose: EmailTokenPurpose;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
}

const EmailTokenSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    purpose: {
      type: String,
      enum: EMAIL_TOKEN_PURPOSES,
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// TTL Index: clears unused tokens once they expire.
EmailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// One live token per user + purpose: issuing a new one supersedes the old.
EmailTokenSchema.index(
  { userId: 1, purpose: 1 },
  { unique: true, partialFilterExpression: { usedAt: null } },
);

export default mongoose.model<IEmailToken>("EmailToken", EmailTokenSchema);