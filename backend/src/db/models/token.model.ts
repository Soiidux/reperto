import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  isRevoked: boolean;
}

const RefreshTokenSchema: Schema = new Schema({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  token: { 
    type: String, 
    required: true, 
    unique: true 
  },
  expiresAt: { 
    type: Date, 
    required: true 
  },
  isRevoked: { 
    type: Boolean, 
    default: false 
  }
}, { 
  timestamps: true 
});

// TTL Index: Automatically deletes the document from MongoDB when expiresAt is reached
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);