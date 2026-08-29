import mongoose from "mongoose";
import config from "../src/config";
import Review from "../src/db/models/review.model";
import User from "../src/db/models/user.model";

async function main() {
  await mongoose.connect(config.mongoUri);
  const testPatients = await User.find({ email: { $regex: /@t\.com$/ } }).select("_id");
  const ids = testPatients.map((u) => u._id);
  const r = await Review.deleteMany({ patientId: { $in: ids } });
  console.log("cleaned test reviews:", r.deletedCount);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});