import API from "./axios";

export const login = async (credentials: { email: string; password: string }) => {
  return API.post("/auth/login", credentials);
};

type RegisterData = {
  name: string;
  email: string;
  password: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  bloodGroup: string;
}
export const register = async (data: RegisterData) => {
  return API.post("/auth/register", data);
};

export const refreshAccessToken = async (): Promise<{ accessToken: string }> => {
  const response = await API.post('/auth/refresh');
  return response.data.data.accessToken;
};

export const logout = async () => {
  const response = await API.post('/auth/logout');
  return response.data;
};