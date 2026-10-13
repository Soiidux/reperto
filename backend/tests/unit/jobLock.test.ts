import { describe, expect, it, beforeAll, beforeEach, afterAll } from "vitest";
import mongoose from "mongoose";
import { acquireJobLock, runIfLeader } from "../../src/utils/jobLock";

/**
 * The reminder jobs run inside each backend process, so a second replica would
 * otherwise send every patient a duplicate reminder. The lock is what stops
 * that — these tests exercise the two properties that matter: only one
 * claimant wins a tick, and a crashed holder cannot block the job forever.
 */

const DB = () => mongoose.connection.collection("jobLocks");

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set — the vitest config must point tests at a dedicated database");
  }
  await mongoose.connect(uri);
});

beforeEach(async () => {
  await DB().deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
});

describe("acquireJobLock", () => {
  it("grants the lock to the first claimant", async () => {
    const lock = await acquireJobLock("test-job");
    expect(lock.acquired).toBe(true);
    await lock.release();
  });

  it("refuses a second claimant while the lock is held", async () => {
    const first = await acquireJobLock("contended-job");
    expect(first.acquired).toBe(true);

    const second = await acquireJobLock("contended-job");
    expect(second.acquired).toBe(false);

    await first.release();
  });

  it("re-acquires after release", async () => {
    const first = await acquireJobLock("release-job");
    await first.release();

    const second = await acquireJobLock("release-job");
    expect(second.acquired).toBe(true);
    await second.release();
  });

  it("keeps separate locks for separate jobs", async () => {
    const a = await acquireJobLock("job-a");
    const b = await acquireJobLock("job-b");
    expect(a.acquired).toBe(true);
    expect(b.acquired).toBe(true);
    await a.release();
    await b.release();
  });

  it("ignores an expired lock, so a crashed process cannot block the job", async () => {
    // Simulate a process that took the lock and died without releasing.
    await DB().insertOne({
      _id: "crashed-job",
      owner: "dead-process",
      acquiredAt: new Date(Date.now() - 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 1000), // already lapsed
    });

    const lock = await acquireJobLock("crashed-job");
    expect(lock.acquired).toBe(true);
    await lock.release();
  });

  it("does not release a lock another owner holds", async () => {
    const mine = await acquireJobLock("shared-job");
    // A second process now owns it.
    await DB().updateOne(
      { _id: "shared-job" },
      { $set: { owner: "other-process" } },
    );

    await mine.release();

    // The other owner's lock survives our release.
    const doc = await DB().findOne({ _id: "shared-job" });
    expect(doc?.owner).toBe("other-process");
  });
});

describe("runIfLeader", () => {
  it("runs the job when the lock is free", async () => {
    let ran = 0;
    await runIfLeader("leader-job", async () => {
      ran += 1;
    });
    expect(ran).toBe(1);
  });

  it("skips the job when another instance holds the lock", async () => {
    const held = await acquireJobLock("busy-job");

    let ran = 0;
    await runIfLeader("busy-job", async () => {
      ran += 1;
    });

    expect(ran).toBe(0);
    await held.release();
  });

  it("releases the lock even when the job throws, so the next tick can run", async () => {
    await expect(
      runIfLeader("failing-job", async () => {
        throw new Error("job blew up");
      }),
    ).rejects.toThrow("job blew up");

    // The lock must not be stranded by the failure.
    const next = await acquireJobLock("failing-job");
    expect(next.acquired).toBe(true);
    await next.release();
  });
});