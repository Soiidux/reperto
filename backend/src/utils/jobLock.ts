import mongoose from "mongoose";
import logger from "./logger";

/**
 * Cross-instance lock for the scheduled jobs.
 *
 * The reminder jobs run on a `setInterval` inside each backend process, so
 * running two replicas would send every patient duplicate reminder emails and
 * SMS. This takes a short-lived, automatically-expiring Mongo lock: the first
 * process to claim a tick runs the job, the others skip it.
 *
 * The TTL matters more than the claim — a process that dies mid-run must not
 * block the next tick forever, so the lock expires on its own.
 */

const LOCK_TTL_MS = 5 * 60 * 1000; // longer than a sweep should take

export type JobLock = {
  /** True when this process acquired the lock and should run the job. */
  acquired: boolean;
  /** Releases the lock. Safe to call even if it expired. */
  release: () => Promise<void>;
};

type LockDoc = {
  _id: string;
  owner: string;
  acquiredAt: Date;
  expiresAt: Date;
};

// A per-process identifier so a crashed process's lock is recognisable in logs.
const PROCESS_ID =
  `${process.pid}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Try to claim the named lock. Returns `acquired: false` when another live
 * process already holds it.
 */
export const acquireJobLock = async (
  name: string,
  ttlMs: number = LOCK_TTL_MS,
): Promise<JobLock> => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const collection = mongoose.connection.collection<LockDoc>("jobLocks");

  // Expire any stale holder first, so a crashed process doesn't hold the job
  // for longer than one TTL.
  await collection.deleteOne({ _id: name, expiresAt: { $lte: now } });

  try {
    // Unique on _id, so a concurrent claim loses the race atomically rather
    // than both believing they hold the lock.
    await collection.insertOne({
      _id: name,
      owner: PROCESS_ID,
      acquiredAt: now,
      expiresAt,
    });

    return {
      acquired: true,
      release: async () => {
        try {
          // Only release a lock we still own.
          await collection.deleteOne({ _id: name, owner: PROCESS_ID });
        } catch (error) {
          logger.warn("Failed to release job lock", {
            job: name,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      },
    };
  } catch (error) {
    // Duplicate key = somebody else got there first. That is the normal path
    // when running more than one instance, not a failure worth alarming about.
    const code = (error as { code?: number })?.code;
    if (code === 11000) {
      logger.debug("Job lock held by another instance", { job: name });
      return { acquired: false, release: async () => {} };
    }
    // A lock store failure must not silently stop the job forever; log and let
    // the caller run rather than skip work.
    logger.error("Job lock error, running unlocked", {
      job: name,
      message: error instanceof Error ? error.message : String(error),
    });
    return { acquired: true, release: async () => {} };
  }
};

/**
 * Run `job` only if this process wins the lock for that tick.
 */
export const runIfLeader = async (
  name: string,
  job: () => Promise<void>,
  ttlMs: number = LOCK_TTL_MS,
): Promise<void> => {
  const lock = await acquireJobLock(name, ttlMs);
  if (!lock.acquired) return;
  try {
    await job();
  } finally {
    await lock.release();
  }
};