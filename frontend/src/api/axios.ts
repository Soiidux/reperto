import axios from "axios";
import { useAuthStore } from "@/store/authStore"; // Adjust path to your auth store

// 🚀 CRITICAL: Create a separate, clean Axios instance purely for token refreshing.
// This instance completely lacks the response interceptor, preventing infinite 401 loops!
const refreshInstance = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
});

// Your primary application client instance
const API = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true,
});

// 1. Request Interceptor: Ensures the absolute freshest token is always injected
API.interceptors.request.use(
  (config) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 2. Response Interceptor: Handles automatic token regeneration loops cleanly
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check for 401 status and confirm this exact request hasn't been re-attempted yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      console.log("401 Unauthorized captured. Attempting session token renewal...");
      originalRequest._retry = true;

      try {
        // 🚀 Use the separate refresh instance to hit your token renewal route
        const response = await refreshInstance.post("/auth/refresh");
        
        // Adjust destructuring depending on if your backend sends it inside response.data or response.data.data
        const accessToken = response.data?.data?.accessToken;
        
        if (!accessToken) {
          throw new Error("No access token returned from rotation endpoint.");
        }

        console.log("Token rotation successful. Updating store cache.");
        
        // Update your Zustand global state memory
        useAuthStore.getState().setToken(accessToken);

        // Inject the freshly minted token explicitly into the re-attempt header
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        
        // Re-execute the original network request cleanly
        return API(originalRequest);
      } catch (refreshError) {
        console.error("Refresh token has expired or is invalid. Evicting session:", refreshError);
        
        // Wipe local memory stores and bounce the client back to the login gateway
        useAuthStore.getState().logout(); 
        window.location.href = "/login";
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default API;


