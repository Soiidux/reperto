import API from "./axios";
import type { consultationFormSchema } from "@/lib/zodSchemas";

export const createConsultation = async (data: consultationFormSchema & { appointmentId: string }) => {
  const response = await API.post("/consultation", data);
  return response;
};


export const getConsultation = async (patientId: string, appointmentId: string) => {
  const response = await API.get(`/consultation?patientId=${patientId}&appointmentId=${appointmentId}`);
  return response;
};


export const getPatientHistory = async (patientId: string) => {
  const response = await API.get(`/consultation/history/${patientId}`);
  return response;
};


export const getLatestConsultation = async (patientId: string) => {
  const response = await API.get(`/consultation/latest/${patientId}`);
  return response;
};

export const getPrescription = async (consultationId: string) => {
  return await API.get(`/consultation/${consultationId}/prescription`, {
    responseType: "blob",
  });
};

export const getConsultationSummary = async (consultationId: string) => {
  return await API.get(`/consultation/${consultationId}/summary`, {
    responseType: "blob",
  });
};

export const getFollowUps = async () => {
  return await API.get("/consultation/follow-ups");
};

export const markFollowUp = async (consultationId: string, status: "done" | "skipped" | "restored") => {
  return await API.patch(`/consultation/${consultationId}/follow-up`, { status });
};