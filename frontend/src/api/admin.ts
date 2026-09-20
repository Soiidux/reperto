import API from "./axios";

export interface UserSummary {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "doctor" | "staff" | "patient";
  gender: "male" | "female" | "other";
  dateOfBirth?: string;
  bloodGroup?: string;
  profileImageUrl?: string;
  isActive: boolean;
  doctorProfile?: {
    qualifications: string[];
    experienceYears: number;
    specializations: string[];
    languagesSpoken: string[];
    consultationFee: number;
  };
}

export interface AdminStats {
  totalPatients: number;
  totalDoctors: number;
  totalStaff: number;
  totalAppointments: number;
  todaysAppointments: number;
  pendingAppointments: number;
  completedConsultations: number;
}

export interface MonthPoint {
  month: string;
  label: string;
  value: number;
  count?: number;
}

export interface DoctorAppointmentBreakdown {
  doctorId: string;
  doctorName: string;
  total: number;
  statuses: Record<string, number>;
}

export interface AdminAnalytics {
  appointmentsByDoctor: DoctorAppointmentBreakdown[];
  statusRates: { status: string; count: number }[];
  totalAppointments30d: number;
  newPatientsByMonth: MonthPoint[];
}

export const getAdminAnalytics = async () => {
  return await API.get("/admin/analytics");
};

export const getAdminStats = async () => {
  return await API.get("/admin/stats");
};

export const getAllUsers = async (params?: {
  search?: string;
  role?: string;
  isActive?: string | boolean;
  page?: number;
  limit?: number;
}) => {
  return await API.get("/admin/users", { params });
};

export const toggleUserActive = async (id: string, isActive: boolean) => {
  return await API.patch(`/admin/users/${id}/activate`, { isActive });
};

export const createTeamMember = async (data: TeamMemberInput) => {
  return await API.post("/admin/team", data);
};

// CSV exports return raw text (responseType "text"), not JSON.
export const exportAppointmentsCsv = async (params?: {
  from?: string;
  to?: string;
  status?: string;
}) => {
  return await API.get("/admin/export/appointments", {
    params,
    responseType: "text",
  });
};

export const exportPatientsCsv = async () => {
  return await API.get("/admin/export/patients", { responseType: "text" });
};

export interface TeamMemberInput {
  name: string;
  email: string;
  password: string;
  phone: string;
  gender: "male" | "female" | "other";
  dateOfBirth: string;
  bloodGroup: string;
  role: "doctor" | "staff";
  doctorProfile?: {
    qualifications?: string[];
    experienceYears?: number;
    specializations?: string[];
    languagesSpoken?: string[];
    consultationFee?: number;
  };
}

// ---- Clinic settings & date blockouts ----

export interface ClinicDayHoursInput {
  day: number;
  isOpen: boolean;
  slots: string[];
}

export interface ClinicSettingsInput {
  clinicName: string;
  address: string;
  phone: string;
  email: string;
  about: string;
  cancellationWindowMinutes: number;
  hours: ClinicDayHoursInput[];
}

export interface ClinicBlockout {
  date: string; // YYYY-MM-DD (clinic timezone)
  allDay: boolean;
  slots: string[];
  reason: string;
}

export const updateClinicSettings = async (data: ClinicSettingsInput) => {
  return await API.put("/admin/clinic-settings", data);
};

export const getClinicBlockouts = async (params?: { from?: string; to?: string }) => {
  return await API.get("/admin/clinic-blockouts", { params });
};

export const saveClinicBlockout = async (data: {
  date: string;
  allDay?: boolean;
  slots?: string[];
  reason?: string;
}) => {
  return await API.post("/admin/clinic-blockouts", data);
};

export const deleteClinicBlockout = async (date: string) => {
  return await API.delete(`/admin/clinic-blockouts/${date}`);
};