import API from "./axios";

export interface Review {
  _id: string;
  patientId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
  };
  doctorId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export const getReviewList = async (doctorId: string) => {
  return await API.get(`/review?doctorId=${doctorId}`);
};

export const saveReview = async (data: {
  doctorId: string;
  rating: number;
  comment?: string;
}) => {
  return await API.post("/review", data);
};

export const deleteReview = async (doctorId: string) => {
  return await API.delete(`/review/${doctorId}`);
};