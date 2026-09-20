import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import { formatInTimeZone } from "date-fns-tz";
import app from "../../src/app";
import User from "../../src/db/models/user.model";
import ClinicSettings from "../../src/db/models/clinicSettings.model";
import ClinicBlockout from "../../src/db/models/clinicBlockout.model";
import {
  DEFAULT_DAY_SLOTS,
  buildDefaultSettings,
} from "../../src/utils/clinicSettings";
import { getClinicTodayAnchor } from "../../src/utils/clinicDate";
import { CLINIC_TIMEZONE } from "../../src/constants/clinic";

const DAY_MS = 24 * 60 * 60 * 1000;

const TEST_USERS: Record<string, { email: string; password: string }> = {
  admin: { email: "test.admin@reperto.example", password: "Test@12345" },
  patient: { email: "test.patient@reperto.example", password: "Test@12345" },
  doctor: { email: "test.doctor@reperto.example", password: "Test@12345" },
};

/** Date a few clinic-days ahead of today, as YYYY-MM-DD in the clinic TZ. */
const clinicDateAhead = (days: number): string => {
  const anchor = getClinicTodayAnchor();
  return formatInTimeZone(
    new Date(anchor.getTime() + days * DAY_MS),
    CLINIC_TIMEZONE,
    "yyyy-MM-dd",
  );
};

/** Seven-day hours payload matching the default grid (Sunday closed). */
const hoursForAllDays = () =>
  Array.from({ length: 7 }, (_, day) => ({
    day,
    isOpen: day !== 0,
    slots: day === 0 ? [] : DEFAULT_DAY_SLOTS,
  }));

const settingsBody = (overrides: Record<string, unknown> = {}) => ({
  ...buildDefaultSettings(),
  email: "care@reperto.example",
  hours: hoursForAllDays(),
  ...overrides,
});

let adminToken = "";
let patientToken = "";
let doctorToken = "";

const login = async (role: keyof typeof TEST_USERS): Promise<string> => {
  const res = await request(app).post("/api/auth/login").send({
    email: TEST_USERS[role].email,
    password: TEST_USERS[role].password,
  });
  expect(res.status).toBe(200);
  return res.body.data.accessToken as string;
};

beforeAll(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set — the vitest config must point tests at a dedicated database",
    );
  }
  await mongoose.connect(uri);

  // Idempotent seed: dedicated accounts for each role.
  for (const role of Object.keys(TEST_USERS) as (keyof typeof TEST_USERS)[]) {
    const { email, password } = TEST_USERS[role];
    const hashed = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          name: `Test ${role}`,
          email,
          password: hashed,
          phone: "9999999999",
          gender: "other",
          dateOfBirth: new Date("1990-01-01"),
          bloodGroup: "O+",
          role,
          accountType: "self",
          isActive: true,
          emailVerified: true,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
  }

  adminToken = await login("admin");
  patientToken = await login("patient");
  doctorToken = await login("doctor");
});

beforeEach(async () => {
  // Fresh settings/blockouts per test — public GET re-mints the defaults.
  await ClinicSettings.deleteMany({});
  await ClinicBlockout.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const adminPut = (body: unknown) =>
  request(app)
    .put("/api/admin/clinic-settings")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(body);

const adminBlockout = (body: unknown) =>
  request(app)
    .post("/api/admin/clinic-blockouts")
    .set("Authorization", `Bearer ${adminToken}`)
    .send(body);

describe("public clinic settings", () => {
  it("serves sane defaults without authentication", async () => {
    const res = await request(app).get("/api/clinic/settings");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.clinicName).toBe("Reperto Homeopathic Clinic");
    expect(data.cancellationWindowMinutes).toBe(120);
    expect(data.hours).toHaveLength(7);
    expect(data.today).toHaveProperty("day");
    expect(data.today).toHaveProperty("isOpen");
    expect(data.today.slots).toBeInstanceOf(Array);
  });
});

describe("admin clinic settings", () => {
  it("rejects updates without a token", async () => {
    const res = await request(app)
      .put("/api/admin/clinic-settings")
      .send(settingsBody());
    expect(res.status).toBe(401);
  });

  it("rejects non-admin roles", async () => {
    for (const token of [patientToken, doctorToken]) {
      const res = await request(app)
        .put("/api/admin/clinic-settings")
        .set("Authorization", `Bearer ${token}`)
        .send(settingsBody());
      expect(res.status).toBe(403);
    }
  });

  it("persists admin changes and reflects them on the public endpoint", async () => {
    const res = await adminPut(
      settingsBody({ clinicName: "Test Clinic", cancellationWindowMinutes: 4320 }),
    );
    expect(res.status).toBe(200);
    expect(res.body.data.clinicName).toBe("Test Clinic");
    expect(res.body.data.cancellationWindowMinutes).toBe(4320);

    const pub = await request(app).get("/api/clinic/settings");
    expect(pub.body.data.clinicName).toBe("Test Clinic");
    expect(pub.body.data.cancellationWindowMinutes).toBe(4320);
  });

  it("validates the settings document", async () => {
    const noName = await adminPut(settingsBody({ clinicName: "   " }));
    expect(noName.status).toBe(400);

    const sixDays = await adminPut(
      settingsBody({ hours: hoursForAllDays().slice(0, 6) }),
    );
    expect(sixDays.status).toBe(400);

    const offGrid = await adminPut(
      settingsBody({
        hours: hoursForAllDays().map((h) =>
          h.day === 1 ? { ...h, slots: ["10:07"] } : h,
        ),
      }),
    );
    expect(offGrid.status).toBe(400);

    const duplicateDay = await adminPut(
      settingsBody({
        hours: [...hoursForAllDays(), hoursForAllDays()[1]],
      }),
    );
    expect(duplicateDay.status).toBe(400);
  });
});

describe("clinic blockouts", () => {
  it("blocks a whole future day and overwrites on the same date", async () => {
    const dateStr = clinicDateAhead(5);
    const res = await adminBlockout({
      date: dateStr,
      allDay: true,
      reason: "Staff training",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.allDay).toBe(true);
    expect(res.body.data.slots).toEqual([]);
    expect(res.body.data.date).toBe(dateStr);

    let list = await request(app)
      .get("/api/admin/clinic-blockouts")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.body.data).toHaveLength(1);

    // Same date, now partial — the earlier all-day blockout is replaced.
    const partial = await adminBlockout({
      date: dateStr,
      allDay: false,
      slots: ["10:00", "10:15"],
    });
    expect(partial.status).toBe(200);
    expect(partial.body.data.allDay).toBe(false);
    expect(partial.body.data.slots).toEqual(["10:00", "10:15"]);

    list = await request(app)
      .get("/api/admin/clinic-blockouts")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.body.data).toHaveLength(1);
  });

  it("blocks specific slots for a future date", async () => {
    const dateStr = clinicDateAhead(3);
    const res = await adminBlockout({
      date: dateStr,
      allDay: false,
      slots: ["14:00", "14:30"],
      reason: "Power cut 2-3 PM",
    });
    expect(res.status).toBe(200);
    expect(res.body.data.allDay).toBe(false);
    expect(res.body.data.slots).toEqual(["14:00", "14:30"]);
    expect(res.body.data.reason).toBe("Power cut 2-3 PM");
  });

  it("rejects past dates, malformed dates, off-grid slots and empty blockouts", async () => {
    const yesterday = clinicDateAhead(-1);
    const past = await adminBlockout({
      date: yesterday,
      allDay: true,
    });
    expect(past.status).toBe(400);

    const malformed = await adminBlockout({
      date: "2026-99-99",
      allDay: true,
    });
    expect(malformed.status).toBe(400);

    const offGrid = await adminBlockout({
      date: clinicDateAhead(2),
      allDay: false,
      slots: ["10:07"],
    });
    expect(offGrid.status).toBe(400);

    const empty = await adminBlockout({
      date: clinicDateAhead(2),
      allDay: false,
      slots: [],
    });
    expect(empty.status).toBe(400);
  });

  it("lists blockouts with date filters and deletes them", async () => {
    const d1 = clinicDateAhead(3);
    const d2 = clinicDateAhead(5);
    await adminBlockout({ date: d1, allDay: true });
    await adminBlockout({ date: d2, allDay: true });

    const list = await request(app)
      .get("/api/admin/clinic-blockouts")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((b: { date: string }) => b.date)).toEqual([
      d1,
      d2,
    ]);

    const upTo = await request(app)
      .get(`/api/admin/clinic-blockouts?to=${d1}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(upTo.body.data.map((b: { date: string }) => b.date)).toEqual([d1]);

    const badFilter = await request(app)
      .get("/api/admin/clinic-blockouts?from=not-a-date")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(badFilter.status).toBe(400);

    const del = await request(app)
      .delete(`/api/admin/clinic-blockouts/${d1}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    const delAgain = await request(app)
      .delete(`/api/admin/clinic-blockouts/${d1}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(delAgain.status).toBe(404);

    const badDelete = await request(app)
      .delete("/api/admin/clinic-blockouts/not-a-date")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(badDelete.status).toBe(400);
  });

  it("blocks non-admins from the admin blockout endpoints", async () => {
    for (const token of [patientToken, doctorToken]) {
      const res = await request(app)
        .get("/api/admin/clinic-blockouts")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
    }
  });
});

describe("health check", () => {
  it("reports the database is connected", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.data.db).toBe("up");
  });
});