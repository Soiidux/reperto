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

// The database name is the only thing standing between a typo in MONGODB_URI
// and a real clinic's records, because the suite drops databases. Fail loudly
// and early if the URI doesn't describe a clean, server-only connection.
const TEST_DB_MARKER = "reperto_test";

/** The database segment of a mongodb URI, or "" when it points at the server. */
const dbSegmentOf = (uri: string): string => {
  const withoutQuery = uri.split("?")[0] ?? "";
  // Drop scheme://[user:pass@]host[:port]
  const afterScheme = withoutQuery.replace(/^mongodb(\+srv)?:\/\//, "");
  const afterCreds = afterScheme.includes("@")
    ? afterScheme.slice(afterScheme.indexOf("@") + 1)
    : afterScheme;
  const slash = afterCreds.indexOf("/");
  return slash === -1 ? "" : afterCreds.slice(slash + 1);
};

const baseDb = dbSegmentOf(baseUri);
if (baseDb) {
  throw new Error(
    [
      `MONGODB_URI already names a database ("${baseDb}").`,
      `The test URI is built by appending "/${TEST_DB_MARKER}", which would produce`,
      `the nonsense path "${baseDb}/${TEST_DB_MARKER}".`,
      "Point MONGODB_URI at the server only (no database segment) so the suite",
      "can choose its own test database.",
    ].join("\n"),
  );
}

const dbName = dbSegmentOf(testUri);
if (testUri && dbName !== TEST_DB_MARKER) {
  throw new Error(
    [
      `Refusing to run tests against "${dbName || "<no database>"}".`,
      `The test suite is allowed to DROP databases, so it must use "${TEST_DB_MARKER}".`,
      `Resolved test URI: ${testUri.replace(/\/\/([^:]+):[^@]+@/, "//$1:****@")}`,
    ].join("\n"),
  );
}

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
    // Drop the test database once, up front, instead of in each file's
    // afterAll (which raced with other suites' fixtures).
    globalSetup: ["tests/globalSetup.ts"],
    // The API files share one dedicated database (reperto_test); run them
    // sequentially so one file's beforeEach/afterAll never clobbers another's
    // fixtures while its tests are mid-flight.
    fileParallelism: false,
    pool: "threads",
  },
});