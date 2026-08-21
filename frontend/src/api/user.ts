import API from "./axios";

export const getDoctors = async () => {
  return await API.get("/user/doctors");
}

export const getMe = async () => {
  return await API.get("/user/me");
}

export const getPatients = async (
  params?: { search?: string; page?: number; limit?: number },
  config?: { signal?: AbortSignal }
) => {
  return await API.get("/user/patients", { params, ...config });
}