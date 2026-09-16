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
  totalInvoices: number;
  totalPaidInvoices: number;
  totalCancelledInvoices: number;
  collectedRevenue: number;
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
  revenueByMonth: MonthPoint[];
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