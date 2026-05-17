import API from "./axios";

export const login = async (credentials: { email: string; password: string }) => {
  return API.post("/auth/login", credentials);
};

export const refreshAccessToken = async (): Promise<{ accessToken: string }> => {
  const response = await API.post('/auth/refresh');
  return response.data.data.accessToken;
};