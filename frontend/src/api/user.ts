import API from "./axios";

export const getDoctors = async () => {
  return await API.get("/user/doctors");
}

