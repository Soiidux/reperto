import crypto from "crypto";
import EmailToken, { EmailTokenPurpose } from "../db/models/emailToken.model";
import { hashToken } from "./tokenHash";
import config from "../config";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const generate = () => crypto.randomBytes(32).toString("hex");

export const buildActionLink = (purpose: "verify-email" | "reset-password", token: string) => {
  const path = purpose === "verify-email" ? "verify-email" : "reset-password";
  return `${config.clientOrigin}/${path}?token=${token}`;
};

// Creates a fresh single-use token for {user, purpose}, superseding any
// previous live token (reusing reset/verify links is never allowed).
export const issueEmailToken = async (userId: string, purpose: EmailTokenPurpose) => {
  const token = generate();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
  await EmailToken.findOneAndUpdate(
    { userId, purpose },
    { userId, purpose, tokenHash, expiresAt, usedAt: null },
    { upsert: true },
  );
  return token;
};

export const consumeEmailToken = async (token: string, purpose: EmailTokenPurpose) => {
  const tokenHash = hashToken(token);
  const doc = await EmailToken.findOne({ tokenHash, purpose, usedAt: null });
  if (!doc) return null;
  if (doc.expiresAt < new Date()) return null;
  doc.usedAt = new Date();
  await doc.save();
  return doc.userId.toString();
};