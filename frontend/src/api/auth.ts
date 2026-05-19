import API from "./axios";

import type { loginFormSchema, registerFormSchema } from "@/lib/zodSchemas";
export const login = async (data: loginFormSchema) => {
  return await API.post("/auth/login", data);;
};

export const register = async (data: registerFormSchema) => {
  return await API.post("/auth/register", data);
};

export const logout = async () => {
  return await API.post('/auth/logout');
};