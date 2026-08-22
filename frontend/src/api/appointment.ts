import  API  from "./axios";
import type { appointmentFormSchema } from "@/lib/zodSchemas";


export const getAvailableSlots = async (doctorId: string, date: string, durationInMinutes: string = "30") => {
  const response = await API.get("/appointment/available-slots", {
    params: {
      doctorId,
      date,
      durationInMinutes
    }
  });
  return response;
};

export const getActiveAppointments = async () => {
  const response = await API.get("/appointment/active");
  return response;
};

export const getAllAppointments = async (params?: { status?: string; page?: number; limit?: number }) => {
  const response = await API.get("/appointment/", { params });
  return response;
};

export const getTodaysAppointments = async () => {
  const response = await API.get("/appointment/today");
  return response;
};

export const getAppointmentById = async (id: string) => {
  const response = await API.get(`/appointment/${id}`);
  return response;
};

export const getArrivedAppointments = async (params?: { scope?: string }) => {
  const response = await API.get("/appointment/arrived", { params });
  return response;
};

export const bookAppointment = async (data: appointmentFormSchema) => {
  return await API.post("/appointment/", data);
};

export const updateAppointmentStatus = async (id: string, data: {status: string, cancellationReason: string | undefined}) => {
  return await API.patch(`/appointment/${id}/status`, data);
};

export const rescheduleAppointment = async (id: string, data: { appointmentDate: string; timeSlot: string }) => {
  return await API.patch(`/appointment/${id}/reschedule`, data);
};