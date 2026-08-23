// One-off idempotent migration: stamp every pre-family-accounts user as
// accountType "self". Must run before/at deploy time because the partial
// unique email index (accountType: 'self') silently stops guarding docs
// that lack the field.
//
// Usage: npx tsx scripts/backfill-account-type.ts
import mongoose from "mongoose";
import config from "../src/config";
import User from "../src/db/models/user.model";

async function main() {
  await mongoose.connect(config.mongoUri);
  const result = await User.updateMany(
    { accountType: { $exists: false } },
    { $set: { accountType: "self" } },
  );
  console.log(`Backfilled ${result.modifiedCount} users to accountType "self"`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
