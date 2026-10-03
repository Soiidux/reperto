import { Request, Response } from "express";
import {
  getClinicSettings,
  getClinicLiveStatus,
  getDayEntry,
  getClinicWeekday,
} from "../utils/clinicSettings";

/**
 * Public clinic card data — name, address, phone, today's hours and the
 * cancellation policy. Unauthenticated on purpose: the public home page and
 * Find Doctors are visible before login, and none of this is sensitive.
 *
 * `today.isOpen` is the schedule ("we're open on Saturdays"); `isOpenNow`
 * is the honest live state at this instant in clinic time.
 */
export const getPublicClinicSettings = async (_req: Request, res: Response) => {
  const settings = await getClinicSettings();
  const now = new Date();
  const today = getDayEntry(settings, now);
  const day = getClinicWeekday(now);
  const live = getClinicLiveStatus(today);

  res.status(200).json({
    success: true,
    message: "Clinic settings",
    data: {
      clinicName: settings.clinicName,
      address: settings.address,
      phone: settings.phone,
      email: settings.email,
      about: settings.about,
      cancellationWindowMinutes: settings.cancellationWindowMinutes,
      hours: settings.hours,
      today: { day, isOpen: today.isOpen, slots: today.slots, ...live },
    },
  });
};