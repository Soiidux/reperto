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
  return response.data;
};


export const bookAppointment = async (data: appointmentFormSchema) => {
  const response = await API.post("/appointment/", data);
  return response;
};