import mongoose from "mongoose";
import config from "./config";
import Consultation, { FollowUpStatus } from "./db/models/consultation.model";
import { computeFollowUpDate } from "./utils/followUps";

/**
 * One-off backfill: derive follow-up timelines for consultations created
 * before the tracker existed. Idempotent — re-running only touches rows that
 * still need a followUpDate (or whose status is stuck on the dated default).
 */
const backfill = async () => {
  try {
    await mongoose.connect(config.mongoUri);

    const consultations: any[] = await Consultation.find().select("createdAt prescriptions followUpDate followUpStatus").lean();

    let updated = 0;
    for (const consultation of consultations) {
      const followUpDate = consultation.followUpDate
        ? consultation.followUpDate
        : computeFollowUpDate(consultation.prescriptions, (consultation as any).createdAt as Date);

      let followUpStatus: FollowUpStatus = followUpDate ? "pending" : "skipped";
      if (consultation.followUpStatus === "done" || consultation.followUpStatus === "skipped") {
        followUpStatus = consultation.followUpStatus;
      } else if (followUpDate && followUpDate.getTime() < Date.now()) {
        followUpStatus = "overdue";
      }

      if (
        followUpDate?.getTime() !== consultation.followUpDate?.getTime() ||
        followUpStatus !== consultation.followUpStatus
      ) {
        await Consultation.updateOne(
          { _id: consultation._id },
          { followUpDate, followUpStatus },
        );
        updated += 1;
      }
    }

    console.log(`Follow-up backfill complete: ${updated}/${consultations.length} consultations updated.`);
  } catch (error) {
    console.error("Follow-up backfill failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

backfill();