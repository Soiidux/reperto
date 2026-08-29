import API from "./axios";

export interface ReportFile {
  url: string;
  publicId: string;
  name: string;
  mimeType: string;
  size: number;
  resourceType: string;
}

export interface Report {
  _id: string;
  patientId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
  };
  uploadedBy: {
    _id: string;
    name: string;
    profileImageUrl?: string;
    role: string;
  };
  title: string;
  category: "lab" | "imaging" | "test" | "other";
  description?: string;
  files: ReportFile[];
  createdAt: string;
}

export const uploadReport = async (formData: FormData) => {
  const response = await API.post("/report", formData);
  return response;
};

export const getPatientReports = async (patientId: string) => {
  const response = await API.get("/report", { params: { patientId } });
  return response;
};

export const deleteReport = async (id: string) => {
  const response = await API.delete(`/report/${id}`);
  return response;
};