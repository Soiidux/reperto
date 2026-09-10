import nodemailer from "nodemailer";
import config from "../config";

type MailOptions = {
  to: string;
  subject: string;
  html: string;
};

// SMTP transport when credentials are configured; otherwise a development
// console transport so email-verification flows stay testable pre-deploy.
const configured = Boolean(config.smtp.host && config.smtp.user);

const transporter = configured
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    })
  : null;

export const emailTransportConfigured = configured;

export const sendEmail = async ({ to, subject, html }: MailOptions) => {
  if (!transporter) {
    console.log(
      "[dev-mail] SMTP not configured — email delivered to console instead.",
    );
    console.log(`[dev-mail] To: ${to}`);
    console.log(`[dev-mail] Subject: ${subject}`);
    console.log(`[dev-mail] Body:\n${html}`);
    console.log("[dev-mail] --- end ---");
    return;
  }
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    html,
  });
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