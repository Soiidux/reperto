import API from "./axios";

export interface ClinicDayHours {
  day: number; // 0 (Sunday) .. 6 (Saturday)
  isOpen: boolean;
  slots: string[]; // "HH:mm" 15-minute slot starts
}

export interface ClinicSettings {
  clinicName: string;
  address: string;
  phone: string;
  email: string;
  about: string;
  cancellationWindowMinutes: number;
  hours: ClinicDayHours[];
  /** Computed server-side in the clinic's timezone for today. */
  today?: { day: number; isOpen: boolean; slots: string[] };
}

// Public — no auth, powers the clinic card on Find Doctors and the booking
// screen's cancellation-policy line.
export const getClinicSettings = async () => {
  return await API.get("/clinic/settings");
};