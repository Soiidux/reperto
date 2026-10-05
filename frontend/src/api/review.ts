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

export interface ReviewSummary {
  avgRating: number;
  totalReviews: number;
  /** Review count per star, 1..5. */
  distribution: Record<string, number>;
}

export interface ReviewListResponse {
  reviews: Review[];
  summary: ReviewSummary;
  /** Whether the signed-in patient may rate this doctor (needs a completed visit). */
  canReview: boolean;
  myReview: Review | null;
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
