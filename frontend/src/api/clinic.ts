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
  today?: {
    day: number;
    /** Scheduled open today (stays true at 3 AM — not the live state). */
    isOpen: boolean;
    slots: string[];
    /** Open at this very moment, in clinic time. */
    isOpenNow: boolean;
    /** First slot of the day ("HH:mm"), null when shut all day. */
    opensAt: string | null;
    /** End of the day's last slot ("HH:mm"), null when shut all day. */
    closesAt: string | null;
    /** When the open/closed state next flips today. */
    nextChangeAt: string | null;
  };
}

// Public — no auth, powers the clinic card on Find Doctors and the booking
// screen's cancellation-policy line.
export const getClinicSettings = async () => {
  return await API.get("/clinic/settings");
};