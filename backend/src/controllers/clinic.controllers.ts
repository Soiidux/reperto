import { Request, Response } from "express";
import {
  getClinicSettings,
  getDayEntry,
  getClinicWeekday,
} from "../utils/clinicSettings";

/**
 * Public clinic card data — name, address, phone, today's hours and the
 * cancellation policy. Unauthenticated on purpose: the Find Doctors page is
 * visible before login, and none of this is sensitive.
 */
export const getPublicClinicSettings = async (_req: Request, res: Response) => {
  const settings = await getClinicSettings();
  const today = getDayEntry(settings, new Date());
  const day = getClinicWeekday(new Date());

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
      today: { day, isOpen: today.isOpen, slots: today.slots },
    },
  });
};