import API from "./axios";

export interface LeaveRecord {
  _id: string;
  doctorId: string;
  type: "full-day" | "half-day" | "emergency";
  startingDate: string;
  startingTime?: string;
  endingDate?: string;
  endingTime?: string;
  reason: string;
}

export const getMyLeaves = async () => {
  return await API.get("/leave/my");
};

export const addLeave = async (data: {
  type: string;
  startingDate: string;
  startingTime?: string;
  endingDate?: string;
  endingTime?: string;
  reason?: string;
}) => {
  return await API.post("/leave/add", data);
};

export const removeLeave = async (leaveId: string) => {
  return await API.delete(`/leave/remove/${leaveId}`);
};