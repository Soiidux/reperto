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