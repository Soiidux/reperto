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

// ---- Family accounts (dependents managed via share codes) ----

export interface FamilyMember {
  _id: string;
  name: string;
  gender: "male" | "female" | "other";
  dateOfBirth: string;
  bloodGroup?: string;
  phone?: string;
  relationship?: "spouse" | "child" | "parent" | "sibling" | "other";
  profileImageUrl?: string;
  shareCode?: string;
  isActive: boolean;
  guardians: { _id: string; name: string; profileImageUrl?: string }[];
}

export const getFamilyMembers = async () => {
  return await API.get("/user/me/family");
}

export const createFamilyMember = async (formData: FormData) => {
  return await API.post("/user/me/family", formData);
}

export const updateFamilyMember = async (
  id: string,
  data: Partial<{ name: string; gender: string; dateOfBirth: string; bloodGroup: string; phone: string; relationship: string }>
) => {
  return await API.patch(`/user/me/family/${id}`, data);
}

export const removeFamilyMember = async (id: string) => {
  return await API.delete(`/user/me/family/${id}`);
}

export const joinFamilyByCode = async (code: string) => {
  return await API.post("/user/me/family/join", { code });
}

export const regenerateShareCode = async (id: string) => {
  return await API.post(`/user/me/family/${id}/share-code`);
}

export const removeGuardian = async (memberId: string, guardianId: string) => {
  return await API.delete(`/user/me/family/${memberId}/guardians/${guardianId}`);
}

export const leaveFamilyMember = async (id: string) => {
  return await API.post(`/user/me/family/${id}/leave`);
}