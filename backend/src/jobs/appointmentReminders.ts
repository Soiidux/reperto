import Appointment from "../db/models/appointment.model";
import User from "../db/models/user.model";
import { getClinicTodayAnchor } from "../utils/clinicDate";
import {
  resolveRecipientEmail,
  sendEmail,
  appointmentReminderEmailHtml,
} from "../utils/email";
import { resolveRecipientPhone, sendSms } from "../utils/sms";
import { runIfLeader } from "../utils/jobLock";
import logger from "../utils/logger";

const DAY_MS = 24 * 60 * 60 * 1000;

const formatDateLabel = (date: Date) =>
  new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

const sendRemindersForDate = async (targetDate: Date) => {
  const from = targetDate;
  const to = new Date(targetDate.getTime() + DAY_MS);

  // Next-day appointment reminders: still-live bookings that have not been
  // reminded yet. `reminderEmailAt` guards against re-sending.
  const due = await Appointment.find({
    appointmentDate: { $gte: from, $lt: to },
    status: { $in: ["pending", "arrived"] },
    reminderEmailAt: null,
  })
    .select("patientId doctorId appointmentDate timeSlot")
    .lean();

  for (const appointment of due) {
    try {
      const recipientEmail = await resolveRecipientEmail(appointment.patientId);
      const recipientPhone = await resolveRecipientPhone(appointment.patientId);

      const doctor = await User.findById(appointment.doctorId)
        .select("name")
        .lean();
      const patient = await User.findById(appointment.patientId)
        .select("name")
        .lean();

      if (recipientEmail) {
        await sendEmail({
          to: recipientEmail,
          subject: "Reminder: your appointment is tomorrow",
          html: appointmentReminderEmailHtml({
            patientName: patient?.name || "there",
            doctorName: doctor?.name || "Your doctor",
            date: formatDateLabel(appointment.appointmentDate),
            timeSlot: appointment.timeSlot,
          }),
        });
      }

      if (recipientPhone) {
        const dateLabel = formatDateLabel(appointment.appointmentDate);
        await sendSms({
          to: recipientPhone,
          text: `Reminder: your appointment with ${doctor?.name || "the doctor"} at Reperto is tomorrow (${dateLabel}) at ${appointment.timeSlot}.`,
        });
      }

      await Appointment.updateOne(
        { _id: appointment._id, reminderEmailAt: null },
        { reminderEmailAt: new Date() },
      );
    } catch (error) {
      console.error(
        `Failed to send reminder for appointment ${appointment._id}:`,
        error,
      );
    }
  }
};

/**
 * Daily reminder sweep. Sends one email to each patient with a pending or
 * arrived appointment scheduled for the clinic's next day.
 */
export const sendAppointmentReminders = async () => {
  const today = getClinicTodayAnchor();
  const tomorrow = new Date(today.getTime() + DAY_MS);
  await sendRemindersForDate(tomorrow);
};

/** Start the hourly sweep; the first run fires after the given delay. */
export const startAppointmentRemindersJob = (
  intervalMs = 60 * 60 * 1000,
  initialDelayMs = 60 * 1000,
) => {
  // Guarded by a cross-instance lock: without it, a second replica would send
  // every patient a duplicate reminder on the same tick.
  const run = () =>
    runIfLeader("appointment-reminders", sendAppointmentReminders).catch(
      (error: unknown) => {
        logger.error("Appointment reminders job failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      },
    );

  setTimeout(run, initialDelayMs);
  return setInterval(run, intervalMs);
};