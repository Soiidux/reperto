import nodemailer from "nodemailer";
import mongoose from "mongoose";
import config from "../config";
import User from "../db/models/user.model";

type MailOptions = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Email delivery picks the first available provider:
 * 1. Resend (HTTP API on 443 — works on networks where outbound SMTP is
 *    blocked) when RESEND_API_KEY is set.
 * 2. SMTP (nodemailer) when SMTP_HOST + SMTP_USER are configured.
 * 3. A development console transport, so email-verification flows stay
 *    testable pre-deploy with no provider configured.
 */
const RESEND_API_URL = "https://api.resend.com/emails";

const smtpConfigured = Boolean(config.smtp.host && config.smtp.user);
const provider: "resend" | "smtp" | "dev" = config.resend.apiKey
  ? "resend"
  : smtpConfigured
    ? "smtp"
    : "dev";

const transporter =
  provider === "smtp"
    ? nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
        // Fail fast: on a network that blocks outbound SMTP these default to
        // a two-minute hang on every send, which stalls the request that
        // triggered the mail.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      })
    : null;

export const emailTransportConfigured = provider !== "dev";

const sendViaResend = async ({ to, subject, html }: MailOptions) => {
  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.resend.from,
      to: [to],
      subject,
      html,
    }),
    // Same reasoning as the SMTP timeouts: never let a mail send outlive the
    // request that triggered it.
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend API request failed (${res.status}): ${detail}`);
  }
};

/**
 * The address that should get emailed notices about a patient: their own
 * email for self accounts, the first guardian's for dependent records.
 * Mirrors the in-app recipient resolution in notifications.ts.
 */
export const resolveRecipientEmail = async (
  patientId: string | mongoose.Types.ObjectId,
): Promise<string | null> => {
  const patient = await User.findById(patientId)
    .select("email accountType guardians")
    .lean();
  if (!patient) return null;
  let recipient: any = patient;
  if (!recipient.email || recipient.accountType === "dependent") {
    const guardianId = patient.guardians?.[0];
    if (!guardianId) return null;
    recipient = await User.findById(guardianId).select("email").lean();
  }
  return recipient?.email || null;
};

export const sendEmail = async ({ to, subject, html }: MailOptions) => {
  if (provider === "resend") {
    await sendViaResend({ to, subject, html });
    return;
  }
  if (transporter) {
    await transporter.sendMail({
      from: config.smtp.from,
      to,
      subject,
      html,
    });
    return;
  }
  console.log(
    "[dev-mail] No email provider configured — email delivered to console instead.",
  );
  console.log(`[dev-mail] To: ${to}`);
  console.log(`[dev-mail] Subject: ${subject}`);
  console.log(`[dev-mail] Body:\n${html}`);
  console.log("[dev-mail] --- end ---");
};

const layout = (body: string) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
    <div style="text-align:center;padding-bottom:16px;border-bottom:2px solid #e5e7eb;">
      <div style="font-size:20px;font-weight:bold;color:#1a1a1a;">Reperto Homeopathic Clinic</div>
    </div>
    <div style="padding:20px 0;line-height:1.6;font-size:15px;">${body}</div>
    <div style="font-size:12px;color:#666;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px;">
      This is an automated message from Reperto. If you did not request this, you can safely ignore it.
    </div>
  </div>`;

// Doctor names may already carry a "Dr." prefix; normalize so templates
// never render the awkward "Dr. Dr. Smith".
const doctorFullName = (name: string) =>
  `Dr. ${name.replace(/^Dr\.?\s+/i, "")}`;

export const verificationEmailHtml = (link: string) =>
  layout(`
    <p style="margin:0 0 16px;">Welcome to Reperto! Please confirm your email address to secure your account.</p>
    <p style="margin:0;">
      <a href="${link}" style="background:#166534;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;display:inline-block;font-weight:bold;">Verify my email</a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#666;">
      Or paste this link into your browser: <a href="${link}">${link}</a><br/>
      This link expires in 60 minutes.
    </p>
  `);

export const resetPasswordEmailHtml = (link: string) =>
  layout(`
    <p style="margin:0 0 16px;">We received a request to reset your Reperto password.</p>
    <p style="margin:0;">
      <a href="${link}" style="background:#166534;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;display:inline-block;font-weight:bold;">Reset my password</a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#666;">
      Or paste this link into your browser: <a href="${link}">${link}</a><br/>
      This link expires in 60 minutes. If you did not request this, you can safely ignore this email.
    </p>
  `);

export const rescheduleNoticeEmailHtml = (options: {
  doctorName: string;
  originalDate: string;
  originalTime: string;
  suggestions: { date: string; timeSlot: string }[];
}) => {
  const listItems = options.suggestions
    .map(
      (s) =>
        `<li style="margin:4px 0;"><strong>${s.date}</strong> at <strong>${s.timeSlot}</strong></li>`,
    )
    .join("");

  return layout(`
    <p style="margin:0 0 16px;">
      Dr. ${options.doctorName} is on leave during your scheduled appointment on
      <strong>${options.originalDate}</strong> at <strong>${options.originalTime}</strong>.
    </p>
    <p style="margin:0 0 8px;">Please pick one of these suggested times to confirm a new slot:</p>
    <ul style="margin:0 0 16px;padding-left:20px;">${listItems}</ul>
    <p style="margin:0 0 16px;">
      Log in to Reperto and open the appointment to accept a suggestion or choose any other
      available slot. Nothing is moved automatically.
    </p>
  `);
};

export const appointmentBookingConfirmationEmailHtml = (options: {
  patientName: string;
  doctorName: string;
  date: string;
  timeSlot: string;
  consultationType: string;
}) =>
  layout(`
    <p style="margin:0 0 16px;">Dear ${options.patientName},</p>
    <p style="margin:0 0 16px;">
      Your appointment at <strong>Reperto Homeopathic Clinic</strong> has been confirmed:
    </p>
    <table style="margin:0 0 16px;border-collapse:collapse;width:100%;font-size:14px;">
      <tr><td style="padding:6px 0;color:#555;">Doctor</td><td style="padding:6px 0;"><strong>${doctorFullName(options.doctorName)}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#555;">Date</td><td style="padding:6px 0;"><strong>${options.date}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#555;">Time</td><td style="padding:6px 0;"><strong>${options.timeSlot}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#555;">Consultation</td><td style="padding:6px 0;"><strong>${options.consultationType}</strong></td></tr>
    </table>
    <p style="margin:0;">Please arrive a few minutes early. You can view or manage this appointment from the Reperto portal.</p>
  `);

export const appointmentCancelledEmailHtml = (options: {
  patientName: string;
  doctorName: string;
  date: string;
  timeSlot: string;
}) =>
  layout(`
    <p style="margin:0 0 16px;">Dear ${options.patientName},</p>
    <p style="margin:0 0 16px;">
      Your appointment with <strong>${doctorFullName(options.doctorName)}</strong> on
      <strong>${options.date}</strong> at <strong>${options.timeSlot}</strong> has been cancelled.
    </p>
    <p style="margin:0;">
      Please book a new slot whenever you are ready — we look forward to seeing you at
      <strong>Reperto Homeopathic Clinic</strong>.
    </p>
  `);

export const appointmentReminderEmailHtml = (options: {
  patientName: string;
  doctorName: string;
  date: string;
  timeSlot: string;
}) =>
  layout(`
    <p style="margin:0 0 16px;">Dear ${options.patientName},</p>
    <p style="margin:0 0 16px;">This is a friendly reminder about your appointment tomorrow:</p>
    <p style="margin:0 0 8px;">
      <strong>${doctorFullName(options.doctorName)}</strong> on <strong>${options.date}</strong> at
      <strong>${options.timeSlot}</strong> at Reperto Homeopathic Clinic.
    </p>
    <p style="margin:0;">If you need to reschedule, please do so through the portal.</p>
  `);

export const followUpDueEmailHtml = (options: {
  patientName: string;
  doctorName: string;
  courseEndDate: string;
}) =>
  layout(`
    <p style="margin:0 0 16px;">Dear ${options.patientName},</p>
    <p style="margin:0 0 16px;">
      Your treatment course with <strong>${doctorFullName(options.doctorName)}</strong> has now run
      its course (ended on <strong>${options.courseEndDate}</strong>).
    </p>
    <p style="margin:0 0 16px;">
      For the best results, please book a follow-up consultation so the doctor can review your progress.
    </p>
    <p style="margin:0 0 16px;">
      <a href="${config.clientOrigin}/patient/consultation/history/" style="background:#166534;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;display:inline-block;font-weight:bold;">View my record</a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#666;">
      If you have already booked a follow-up, please ignore this reminder.
    </p>
  `);