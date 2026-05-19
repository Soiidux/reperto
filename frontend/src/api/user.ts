import API from "./axios";

export const getDoctors = async () => {
  const response = await API.get("/user/doctors");
  return response.data;
}

