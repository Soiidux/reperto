import API from "./axios";

import type { loginFormSchema, registerFormSchema } from "@/lib/zodSchemas";
export const login = async (data: loginFormSchema) => {
  return await API.post("/auth/login", data);;
};

export const register = async (
  data: registerFormSchema & { role?: string; doctorProfile?: unknown },
  profileImage?: File | null,
) => {
  // JSON keeps doctorProfile a real object for admin-created users; the
  // multipart path is only used when a signup photo is attached
  if (!profileImage) {
    return await API.post("/auth/register", data);
  }
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    formData.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  });
  // Field name must match the backend's multer upload.single("profileImage")
  formData.append("profileImage", profileImage);
  return await API.post("/auth/register", formData);
};

export const logout = async () => {
  return await API.post('/auth/logout');
};

export const updateEmail = async (data: { email: string; password: string }) => {
  return await API.patch('/auth/email', data);
};

export const updatePhone = async (data: { phone: string; password: string }) => {
  return await API.patch('/auth/phone', data);
};

export const updatePassword = async (data: { oldPassword: string; newPassword: string }) => {
  return await API.patch('/auth/password', data);
};