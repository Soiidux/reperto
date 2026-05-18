import { create } from "zustand";
import { logout } from "../api/auth";
import { toast } from "sonner";

interface AuthState {
  user: any | null;
  accessToken: string | null;
  login: (userData: any, token: string) => void;
  logout: () => void;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem("user") || "null"),
  accessToken: localStorage.getItem("accessToken") || "null",
  login: (userData, token) => {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("accessToken", token);
    set({ user: userData, accessToken: token });
  },
  logout: async () => {
    try {
      const response = await logout();
      if (response?.success) {
        toast.success(response.message || "Logged out successfully!");
      } else {
        toast.error(response?.message || "Failed to disconnect cleanly.");
      }
    } catch (error) {
      toast.error("An unexpected error occurred during logout.");
      console.error(error.message);
    } finally {
      // Clear state and trigger the redirection cascade LAST
      localStorage.removeItem("user");
      localStorage.removeItem("accessToken");
      set({ user: null, accessToken: null });
    }
  },
  setToken: (token: string) => {
    localStorage.setItem("accessToken", token);
    set({ accessToken: token });
  },
}));
