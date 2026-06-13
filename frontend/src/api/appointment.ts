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

export const getAllAppointments = async () => {
  const response = await API.get("/appointment/");
  return response;
};

export const bookAppointment = async (data: appointmentFormSchema) => {
  return await API.post("/appointment/", data);
};