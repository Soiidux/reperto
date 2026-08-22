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

export const updateProfileImage = async (file: File) => {
  // Field name "profileImage" matches the backend multer single() setup
  const formData = new FormData();
  formData.append("profileImage", file);
  return await API.patch("/user/me/profile-image", formData);
}