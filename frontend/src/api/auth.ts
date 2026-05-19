import API from "./axios";

import type { loginFormSchema, registerFormSchema } from "@/lib/zodSchemas";
export const login = async (data: loginFormSchema) => {
  const response = await API.post("/auth/login", data);
  return response.data;
};


export const register = async (data: registerFormSchema) => {
  const response = await API.post("/auth/register", data);
  return response.data;
};

export const logout = async () => {
  const response = await API.post('/auth/logout');
  return response.data;
};