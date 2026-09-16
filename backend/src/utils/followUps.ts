import { IPrescription, FollowUpStatus } from "../db/models/consultation.model";

// Shared follow-up timeline helpers used by the consultation controller,
// the backfill script and the reminder job so the logic lives in one place.

/**
 * The date a treatment course is expected to end, derived from the longest
 * prescription duration. Returns null when there are no prescriptions or no
 * course length to speak of, meaning no follow-up should be tracked.
 */
export const computeFollowUpDate = (
  prescriptions: IPrescription[] | undefined,
  baseDate: Date,
): Date | null => {
  if (!prescriptions || prescriptions.length === 0) return null;
  const maxDays = Math.max(...prescriptions.map((p) => p.durationInDays));
  if (maxDays <= 0) return null;
  return new Date(baseDate.getTime() + maxDays * 24 * 60 * 60 * 1000);
};

/** Normalise a stored follow-up to its correct status given today's date. */
export const resolveFollowUpStatus = (
  followUpDate: Date | null,
  storedStatus?: FollowUpStatus,
): FollowUpStatus => {
  if (!followUpDate) return 'skipped';
  if (storedStatus === 'done' || storedStatus === 'skipped') {
    return storedStatus;
  }
  return followUpDate.getTime() < Date.now() ? 'overdue' : 'pending';
};