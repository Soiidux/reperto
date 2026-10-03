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
      // Never let the suite send real mail: blank providers force the dev
      // console transport, keeping tests offline and deterministic.
      RESEND_API_KEY: "",
      SMTP_HOST: "",
      SMTP_USER: "",
      SMTP_PASS: "",
    },
    testTimeout: 30000,
    hookTimeout: 30000,
    // The API files share one dedicated database (reperto_test); run them
    // sequentially so one file's beforeEach/afterAll never clobbers another's
    // fixtures while its tests are mid-flight.
    fileParallelism: false,
    pool: "threads",
  },
});