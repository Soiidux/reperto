import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RatingStars } from "@/components/RatingStars";
import {
  deleteReview,
  getReviewList,
  saveReview,
  type Review,
  type ReviewSummary,
} from "@/api/review";
import { useAuthStore } from "@/store/authStore";
import { cn, getErrorMessage } from "@/lib/utils";

type DoctorReviewsProps = {
  doctorId: string;
  doctorName?: string;
  /** Called after save/remove so the caller can refresh its own summary. */
  onChanged?: () => void;
  className?: string;
};

const EMPTY_SUMMARY: ReviewSummary = {
  avgRating: 0,
  totalReviews: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

const formatReviewDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * Doctor reviews: aggregate score, star distribution, and the patient's own
 * rating.
 *
 * Rating is gated server-side on a completed visit, and the server reports
 * that gate as `canReview` — so this component can explain why the form is
 * closed instead of letting the patient fill it in and hit a 403.
 */
export function DoctorReviews({
  doctorId,
  doctorName,
  onChanged,
  className,
}: DoctorReviewsProps) {
  const { user } = useAuthStore();
  const isPatient = user?.role === "patient";

  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary>(EMPTY_SUMMARY);
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReviewList(doctorId);
      const data = res.data?.data;
      setReviews(data?.reviews ?? []);
      setSummary(data?.summary ?? EMPTY_SUMMARY);
      setCanReview(Boolean(data?.canReview));
      // Prefill from the patient's existing review so this is an edit, not a
      // second (which the server would reject anyway).
      setRating(data?.myReview?.rating ?? 0);
      setComment(data?.myReview?.comment ?? "");
      setLoadError(null);
    } catch (error) {
      setLoadError(getErrorMessage(error, "Could not load reviews"));
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const handleSave = async () => {
    if (rating < 1 || saving) return;
    setSaving(true);
    try {
      const res = await saveReview({ doctorId, rating, comment: comment.trim() });
      toast.success(res.data?.message || "Review saved");
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not save your review"));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteReview(doctorId);
      setRating(0);
      setComment("");
      toast.success("Review removed");
      await load();
      onChanged?.();
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not remove your review"));
    } finally {
      setDeleting(false);
    }
  };

  const maxCount = Math.max(1, ...[1, 2, 3, 4, 5].map((n) => summary.distribution[n] ?? 0));

  return (
    <div className={cn("space-y-5", className)}>
      {/* Aggregate */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
        <div className="flex shrink-0 flex-col items-center gap-1 sm:w-28">
          <span className="text-4xl font-bold text-foreground">
            {summary.totalReviews > 0 ? summary.avgRating.toFixed(1) : "—"}
          </span>
          <RatingStars value={summary.avgRating} size={15} />
          <span className="text-xs text-muted-foreground">
            {summary.totalReviews}{" "}
            {summary.totalReviews === 1 ? "review" : "reviews"}
          </span>
        </div>

        {/* Distribution bars: 5 down to 1, widest at the top. */}
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution[star] ?? 0;
            const pct = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-8 shrink-0 text-right text-muted-foreground">
                  {star}★
                </span>
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${star} star: ${count} of ${summary.totalReviews} reviews`}
                >
                  <div
                    className="h-full rounded-full bg-amber-400 transition-[width] duration-500"
                    style={{ width: `${Math.max(count > 0 ? 4 : 0, pct)}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-muted-foreground">
                  {count}
                </span>
              </div>
            );
          })}
          {maxCount === 0 && summary.totalReviews === 0 && (
            <p className="pt-1 text-xs text-muted-foreground">
              No ratings yet{doctorName ? ` for ${doctorName}` : ""}.
            </p>
          )}
        </div>
      </div>

      {/* The signed-in patient's own rating */}
      {isPatient && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <p className="font-semibold text-foreground">
            {canReview
              ? rating > 0
                ? `Your rating for ${doctorName ?? "this doctor"}`
                : `Rate ${doctorName ?? "this doctor"}`
              : "You can't rate this doctor yet"}
          </p>

          {canReview ? (
            <>
              <RatingStars value={rating} onChange={setRating} size={26} />
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience (optional)"
                maxLength={1000}
                className="min-h-20"
                aria-label="Your review comment"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={saving || rating < 1}
                  onClick={handleSave}
                >
                  {saving
                    ? "Saving…"
                    : rating > 0
                      ? "Save review"
                      : "Select a rating"}
                </Button>
                {rating > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRemove}
                    disabled={deleting}
                  >
                    <Trash2 className="size-3.5" />
                    {deleting ? "Removing…" : "Remove my review"}
                  </Button>
                )}
                {rating > 0 && comment.length > 1000 && (
                  <span className="text-xs text-destructive">
                    Comment is {comment.length - 1000} characters too long.
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Reviews can only be left after a completed appointment with this
              doctor.
            </p>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading reviews…
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={load}>
            Try again
          </Button>
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <MessageSquarePlus className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No reviews yet{doctorName ? ` for ${doctorName}` : ""}.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => {
            const isMine = review.patientId._id === user?.id;
            return (
              <li
                key={review._id}
                className={cn(
                  "space-y-2 rounded-xl border border-border bg-card p-4",
                  isMine && "border-primary/40 bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {review.patientId.profileImageUrl ? (
                      <img
                        src={review.patientId.profileImageUrl}
                        alt=""
                        className="size-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                        {review.patientId.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="truncate text-sm font-semibold text-foreground">
                      {isMine ? "You" : review.patientId.name}
                    </span>
                  </div>
                  <RatingStars value={review.rating} size={14} />
                </div>
                {review.comment && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {review.comment}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatReviewDate(review.createdAt)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
