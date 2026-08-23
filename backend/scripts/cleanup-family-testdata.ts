import mongoose from "mongoose";
import config from "../src/config";
import User from "../src/db/models/user.model";
import Appointment from "../src/db/models/appointment.model";
import RefreshToken from "../src/db/models/token.model";

async function main() {
  await mongoose.connect(config.mongoUri);
  const testers = await User.find({
    $or: [
      { email: { $regex: /^(g[123]-|dbg-)/ } },
      {
        accountType: "dependent",
        createdBy: {
          $in: (
            await User.find({ email: { $regex: /^(g[123]-|dbg-)/ } }).select("_id")
          ).map((u) => u._id),
        },
      },
    ],
  }).select("_id");
  const ids = testers.map((t) => t._id);
  if (ids.length) {
    const appt = await Appointment.deleteMany({ patientId: { $in: ids } });
    const tok = await RefreshToken.deleteMany({ userId: { $in: ids } });
    const usr = await User.deleteMany({ _id: { $in: ids } });
    console.log(`deleted ${usr.deletedCount} test users, ${appt.deletedCount} appointments, ${tok.deletedCount} tokens`);
  } else {
    console.log("nothing to clean");
  }
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
