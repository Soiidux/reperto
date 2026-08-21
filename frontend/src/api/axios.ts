import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";

const baseURL =
  (import.meta.env?.VITE_API_URL as string | undefined) ??
  "http://localhost:5000/api";

// Separate clean instance for token refreshing: no response interceptor,
// so a failing refresh can never recurse into itself.
const refreshInstance = axios.create({
  baseURL,
  withCredentials: true,
});

const API = axios.create({
  baseURL,
  withCredentials: true,
});

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

// Refresh tokens rotate server-side: two parallel /auth/refresh calls would
// invalidate each other's tokens and log the user out. Single-flight every
// concurrent 401 through one shared promise instead.
let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = (): Promise<string> => {
  if (!refreshPromise) {
    refreshPromise = refreshInstance
      .post("/auth/refresh")
      .then((response) => {
        const accessToken = response.data?.data?.accessToken;
        if (!accessToken) {
          throw new Error("No access token returned from rotation endpoint.");
        }
        useAuthStore.getState().setToken(accessToken);
        return accessToken as string;
      })
      .finally(() => {
        // Clear the slot so the next expiry starts a fresh rotation
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

type RetriableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

API.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequest | undefined;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/auth/")
    ) {
      originalRequest._retry = true;

      try {
        const accessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return API(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default API;
