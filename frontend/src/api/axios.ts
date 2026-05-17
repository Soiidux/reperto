import { useAuthStore } from '@/store/authStore';
import axios from 'axios';
import { refreshAccessToken } from '@/api/auth';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

API.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken')
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

API.interceptors.response.use((response) => response, async (error) => {
  const originalRequest = error.config;
  if (error.response.status === 401 && error.response?.data?.data?.accessToken && !originalRequest._retry) {
    originalRequest._retry = true;
    try {
      const { accessToken } = await refreshAccessToken();
      useAuthStore.getState().setToken(accessToken);
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return API(originalRequest);
    } catch (refreshError) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(refreshError);
    }
  }
  return Promise.reject(error);
})

export default API;