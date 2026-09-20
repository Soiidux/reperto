import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// Load backend/.env so the overridden test URI can borrow the real cluster
// credentials (MONGODB_URI from .env has no database path segment).
dotenv.config();

const baseUri = process.env.MONGODB_URI ?? "";
// Append a dedicated test database to the same MongoDB server so tests can
// create/destroy data freely without touching the development data.
const queryIndex = baseUri.indexOf("?");
const head = queryIndex === -1 ? baseUri : baseUri.slice(0, queryIndex);
const query = queryIndex === -1 ? "" : baseUri.slice(queryIndex);
const testUri = head
  ? `${head.replace(/\/+$/, "")}/reperto_test${query}`
  : "";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      ...(testUri ? { MONGODB_URI: testUri } : {}),
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    // The API file depends on a real MongoDB connection. Running files with
    // isolated pools prevents cross-file connection races.
    pool: "threads",
  },
});