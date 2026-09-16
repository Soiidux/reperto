import Consultation from "../db/models/consultation.model";
import User from "../db/models/user.model";
import { getClinicTodayAnchor } from "../utils/clinicDate";
import {
  resolveRecipientEmail,
  sendEmail,
  followUpDueEmailHtml,
} from "../utils/email";
import { createInAppNotification } from "../utils/notifications";
import { resolveRecipientPhone, sendSms } from "../utils/sms";

const DAY_MS = 24 * 60 * 60 * 1000;

const formatDateLabel = (date: Date) =>
  new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Daily sweep for finished treatment courses. When a consultation's
 * follow-up date has arrived, the patient (or their guardian) is nudged to
 * book a follow-up and the doctor gets an in-app heads-up. `followUpReminderSentAt`
 * guards against re-sending; overdue rows are normalised to the exit state.
 */
const sendFollowUpRemindersForDate = async (today: Date) => {
  const due = await Consultation.find({
    followUpDate: { $lte: today },
    followUpStatus: { $in: ["pending", "overdue"] },
    followUpReminderSentAt: null,
  })
    .select("patientId doctorId followUpDate diagnosis appointmentId")
    .lean();

  for (const consultation of due) {
    try {
      // Flip stale "pending" rows to "overdue" once their course has ended.
      if (consultation.followUpStatus === "pending") {
        await Consultation.updateOne(
          { _id: consultation._id, followUpStatus: "pending" },
          { followUpStatus: "overdue" },
        );
      }

      const recipientEmail = await resolveRecipientEmail(consultation.patientId);
      const recipientPhone = await resolveRecipientPhone(consultation.patientId);
      const doctor = await User.findById(consultation.doctorId)
        .select("name")
        .lean();
      const patient = await User.findById(consultation.patientId)
        .select("name")
        .lean();

      if (recipientEmail && consultation.followUpDate) {
        await sendEmail({
          to: recipientEmail,
          subject: "Your treatment course is complete — book a follow-up",
          html: followUpDueEmailHtml({
            patientName: patient?.name || "there",
            doctorName: doctor?.name || "your doctor",
            courseEndDate: formatDateLabel(consultation.followUpDate),
          }),
        });
      }

      if (recipientPhone && consultation.followUpDate) {
        const courseEndLabel = formatDateLabel(consultation.followUpDate);
        await sendSms({
          to: recipientPhone,
          text: `Your treatment course with ${doctor?.name || "the doctor"} at Reperto has ended (${courseEndLabel}). Please book a follow-up visit.`,
        });
      }

      await createInAppNotification(consultation.patientId, {
        type: "follow-up-due",
        title: "Treatment course complete",
        body: `Your course with ${doctor?.name || "the doctor"} has ended. Book a follow-up to review your progress.`,
        link: `/patient/consultation/${consultation._id}`,
        appointmentId: consultation.appointmentId,
      });
      await createInAppNotification(consultation.doctorId, {
        type: "follow-up-due",
        title: "Follow-up due",
        body: `${patient?.name || "A patient"}'s treatment course has ended. Review and schedule their follow-up.`,
        link: `/doctor/consultation/${consultation._id}`,
        appointmentId: consultation.appointmentId,
      });

      await Consultation.updateOne(
        { _id: consultation._id, followUpReminderSentAt: null },
        { followUpReminderSentAt: new Date() },
      );
    } catch (error) {
      console.error(
        `Failed to send follow-up reminder for consultation ${consultation._id}:`,
        error,
      );
    }
  }
};

export const sendFollowUpReminders = async () => {
  const today = getClinicTodayAnchor();
  // Sweep again at day end so rows that newly aged to "overdue" still get
  // reminded; the >24h window is harmless because of the idempotent guard.
  const endOfToday = new Date(today.getTime() + DAY_MS - 1);
  await sendFollowUpRemindersForDate(endOfToday);
};

/** Start the daily sweep; the first run fires after the given delay. */
export const startFollowUpRemindersJob = (
  intervalMs = 24 * 60 * 60 * 1000,
  initialDelayMs = 2 * 60 * 1000,
) => {
  setTimeout(() => {
    sendFollowUpReminders().catch((error) => {
      console.error("Follow-up reminders job failed:", error);
    });
  }, initialDelayMs);
  return setInterval(() => {
    sendFollowUpReminders().catch((error) => {
      console.error("Follow-up reminders job failed:", error);
    });
  }, intervalMs);
};