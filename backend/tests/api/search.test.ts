import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import app from "../../src/app";
import User from "../../src/db/models/user.model";
import { buildUserSearchFilter, USER_SEARCH_COLLATION } from "../../src/utils/userSearch";

/**
 * The directory search must actually use an index.
 *
 * The previous $regex implementation scanned the whole collection on every
 * keystroke. This asserts the query plan, not just the results — a filter can
 * return correct rows while being arbitrarily slow, which is exactly what a
 * result-only test would miss.
 */

const TEST_USERS = {
  admin: { email: "test.search.admin@reperto.example", password: "Test@12345" },
  patient: { email: "test.search.patient@reperto.example", password: "Test@12345" },
} as const;

const tokens: Record<string, string> = {};
const userIds: Record<string, string> = {};

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set — the vitest config must point tests at a dedicated database");
  }
  await mongoose.connect(uri);

  for (const role of Object.keys(TEST_USERS) as (keyof typeof TEST_USERS)[]) {
    const { email, password } = TEST_USERS[role];
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          name: role === "patient" ? "Zephyr Testpatient" : "Search Admin",
          email,
          password: hashed,
          phone: "9990001122",
          gender: "other",
          dateOfBirth: new Date("1990-01-01"),
          bloodGroup: "O+",
          role: role === "patient" ? "patient" : "admin",
          accountType: "self",
          isActive: true,
          emailVerified: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    userIds[role] = user!._id.toString();
  }

  for (const role of Object.keys(TEST_USERS) as (keyof typeof TEST_USERS)[]) {
    const res = await request(app).post("/api/auth/login").send({
      email: TEST_USERS[role].email,
      password: TEST_USERS[role].password,
    });
    expect(res.status).toBe(200);
    tokens[role] = res.body.data.accessToken as string;
  }

  // Ensure the collation indexes exist before asserting the plan uses them.
  await User.syncIndexes();
});

afterAll(async () => {
  await mongoose.disconnect();
});

const explain = async (search: string) => {
  const query = {
    role: "patient",
    isActive: true,
    ...buildUserSearchFilter(search),
  };
  const res = await User.find(query)
    .collation(USER_SEARCH_COLLATION)
    .explain("queryPlanner");
  return JSON.stringify(res.queryPlanner?.winningPlan ?? res.queryPlanner);
};

describe("directory search is index-backed", () => {
  it("uses an index union for a name prefix, not a collection scan", async () => {
    const plan = await explain("zephyr");
    expect(plan, "search should not COLLSCAN").not.toContain("COLLSCAN");
    expect(plan, "search should use IXSCAN").toContain("IXSCAN");
  });

  it("indexes every \$or branch", async () => {
    const plan = await explain("zephyr");
    // Three searchable fields => three subplans. If Mongo falls back to a
    // single scan for even one unindexed branch, this drops below three.
    const subplans = (plan.match(/IXSCAN/g) ?? []).length;
    expect(subplans).toBeGreaterThanOrEqual(3);
  });

  it("is still index-backed for a single-character prefix", async () => {
    const plan = await explain("z");
    expect(plan).not.toContain("COLLSCAN");
  });

  it("declares a case-insensitive collation index on every searchable field", async () => {
    const indexes = await User.collection.indexes();
    const collated = indexes
      .filter((i) => i.collation)
      .map((i) => ({
        name: i.name,
        locale: (i.collation as { locale: string }).locale,
        strength: (i.collation as { strength: number }).strength,
      }));

    for (const field of ["name", "email", "phone"]) {
      const match = collated.find(
        (c) =>
          indexes.some(
            (i) => i.name === c.name && i.key[Object.keys(i.key)[0]] === 1 && Object.keys(i.key).length === 1,
          ) && c.name.includes(field),
      );
      expect(match, `missing collation index on ${field}`).toBeTruthy();
      expect(match!.locale).toBe("en");
      // strength 2 = case-insensitive; anything else won't match how we query.
      expect(match!.strength).toBe(2);
    }
  });
});

describe("directory search results", () => {
  const search = (term: string) =>
    request(app)
      .get(`/api/admin/users?search=${encodeURIComponent(term)}`)
      .set("Authorization", `Bearer ${tokens.admin}`);

  it("finds a patient by name prefix", async () => {
    const res = await search("zephyr");
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: { _id: string }) => u._id);
    expect(ids).toContain(userIds.patient);
  });

  it("matches case-insensitively, via the collation", async () => {
    const res = await search("ZEPHYR");
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: { _id: string }) => u._id);
    expect(ids).toContain(userIds.patient);
  });

  it("finds a patient by email", async () => {
    const res = await search(TEST_USERS.patient.email);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: { _id: string }) => u._id);
    expect(ids).toContain(userIds.patient);
  });

  it("finds a patient by phone", async () => {
    const res = await search("9990001122");
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: { _id: string }) => u._id);
    expect(ids).toContain(userIds.patient);
  });

  it("returns nothing for a term that matches no prefix", async () => {
    const res = await search("qqzzxx");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("does not treat regex metacharacters as a pattern", async () => {
    // ".*" must match a literal ".*", not everything.
    const res = await search(".*");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});