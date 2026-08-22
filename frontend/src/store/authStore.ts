import { create } from "zustand";
import { logout } from "../api/auth";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
  profileImageUrl?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  login: (userData: User, token: string) => void;
  logout: () => void;
  setToken: (token: string) => void;
  setUser: (userData: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem("user") || "null"),
  accessToken: localStorage.getItem("accessToken"),
  login: (userData, token) => {
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("accessToken", token);
    set({ user: userData, accessToken: token });
  },
  // Merges partial updates (e.g. profile image) into the stored user
  setUser: (userData) => {
    const current = JSON.parse(localStorage.getItem("user") || "null") as User | null;
    if (!current) return;
    const updated = { ...current, ...userData };
    localStorage.setItem("user", JSON.stringify(updated));
    set({ user: updated });
  },
  logout: async () => {
    try {
      const response = await logout();
      if (response?.data.success) {
        toast.success(response.data.message || "Logged out successfully!");
      } else {
        toast.error(response?.data.message || "Failed to disconnect cleanly.");
      }
    } catch (error) {
      toast.error("An unexpected error occurred during logout.");
      console.error((error as Error)?.message || error);
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
