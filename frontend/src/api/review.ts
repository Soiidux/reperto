import API from "./axios";
import type { GetReviewData, PostReviewData } from "@/types/api.generated";

/**
 * Review types come from the server's own response schema.
 *
 * `Review`, `ReviewSummary` and `ReviewListResponse` used to be declared here by
 * hand. They were correct, but nothing connected them to the server: a renamed
 * field would have kept compiling here and surfaced as `undefined` at runtime.
 * These aliases derive from the OpenAPI document the server publishes, so a
 * rename on the server becomes a type error here instead.
 *
 * Note the fields are not the obvious names: `avgRating` (not
 * `averageRating`), a `distribution` histogram, and `canReview`/`myReview`
 * sitting beside `summary` rather than inside it. The generated types encode
 * all of that; a hand-written version would have had to be re-guessed each time.
 */
export type ReviewListResponse = GetReviewData;
export type Review = GetReviewData["reviews"][number];
export type ReviewSummary = GetReviewData["summary"];
export type UpsertedReview = PostReviewData;

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
