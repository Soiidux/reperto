import API from "./axios";

import type { loginFormSchema, registerFormSchema } from "@/lib/zodSchemas";
export const login = async (data: loginFormSchema) => {
  return await API.post("/auth/login", data);;
};

export const register = async (data: registerFormSchema & { role?: string; doctorProfile?: unknown }) => {
  return await API.post("/auth/register", data);
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