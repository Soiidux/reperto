import mongoose from "mongoose";
import config from "../config";
import User from "../db/models/user.model";

type SmsOptions = {
  to: string;
  text: string;
};

export const smsConfigured = Boolean(config.sms.provider && config.sms.apiKey);

/**
 * Provider-agnostic SMS: any provider that accepts a POST of
 * `{ to, text, apiKey }` to `SMS_URL` works out of the box. When
 * `SMS_PROVIDER`/`SMS_API_KEY` are not configured this is a development
 * console transport, mirroring the email util.
 */
export const sendSms = async ({ to, text }: SmsOptions) => {
  if (!smsConfigured) {
    console.log("[dev-sms] SMS not configured — message delivered to console instead.");
    console.log(`[dev-sms] To: ${to}`);
    console.log(`[dev-sms] Body: ${text}`);
    console.log("[dev-sms] --- end ---");
    return;
  }
  const response = await fetch(config.sms.url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, text, apiKey: config.sms.apiKey }),
  });
  if (!response.ok) {
    throw new Error(`SMS provider returned ${response.status}: ${await response.text()}`);
  }
};

const normalizePhone = (phone: string | undefined): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (digits.length < 10) return null;
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
};

/**
 * The number that should get SMS notices about a patient: their own for
 * self accounts, the first guardian's for dependent records. Mirrors
 * `resolveRecipientEmail`.
 */
export const resolveRecipientPhone = async (
  patientId: string | mongoose.Types.ObjectId,
): Promise<string | null> => {
  const patient = await User.findById(patientId)
    .select("phone accountType guardians")
    .lean();
  if (!patient) return null;
  let recipient: any = patient;
  if (!recipient.phone || recipient.accountType === "dependent") {
    const guardianId = patient.guardians?.[0];
    if (!guardianId) return null;
    recipient = await User.findById(guardianId).select("phone").lean();
  }
  return normalizePhone(recipient?.phone);
};