import { create } from "zustand";
import { getDoctors } from "@/api/user";

interface Doctor {
  _id: string;
  name: string;
  profileImageUrl: string;
  doctorProfile: {
    qualifications: string[];
    experienceYears: number;
    specializations: string[];
    languagesSpoken: string[];
    consultationFee: number;
  };
};

interface DoctorStore {
  doctors: Doctor[];
  isLoading: boolean;
  error: string | null;
  fetchDoctors: (params?: { name?: string, specialization?: string }) => Promise<void>;
}

const useDoctorStore = create<DoctorStore>((set) => ({
  doctors: [],
  isLoading: false,
  error: null,
  fetchDoctors: async () => {
    try {
      set({ isLoading: true })
      const response = await getDoctors();
      const doctors = response.data;
      set({ doctors, isLoading: false })
    } catch (error) {
      set({ error: 'Failed to fetch doctors', isLoading: false })
    }
  },
}))

export { useDoctorStore, Doctor };
