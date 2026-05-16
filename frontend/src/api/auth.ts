import API from "./axios";

export const login = async (credentials: { email: string; password: string }) => {
  return API.post("/auth/login", credentials);
};