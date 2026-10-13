import mongoose from "mongoose";
import dotenv from "dotenv";
import type { TestProject } from "vitest/node";

/**
 * Wipe the test database once, before any suite runs.
 *
 * Each API suite used to call `dropDatabase()` in its own `afterAll`. Because
 * the files run sequentially but independently, the last one to finish dropped
 * the database while others still had fixtures — which is exactly how an early
 * draft of the reports suite wiped a sibling's data mid-run. Dropping once, up
 * front, is both faster and removes that whole class of ordering bug.
 *
 * Safety: vitest.config.ts refuses to resolve a test URI whose database name
 * does not end in "reperto_test", so this cannot reach a real database.
 */

dotenv.config();

export async function setup(project: TestProject) {
  // The config's test env is resolved per-project; read it from there so this
  // uses exactly the same URI the suites will.
  const uri =
    project.config.env?.MONGODB_URI ??
    process.env.MONGODB_URI ??
    "";

  if (!uri) {
    throw new Error("MONGODB_URI is not set — cannot prepare the test database");
  }

  const dbName = uri.split("/").pop()?.split("?")[0] ?? "";
  if (!dbName.endsWith("reperto_test")) {
    throw new Error(
      `Refusing to drop "${dbName}": the test database must be named "...reperto_test".`,
    );
  }

  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}