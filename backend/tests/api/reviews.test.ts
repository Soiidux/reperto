import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import request from "supertest";
import app from "../../src/app";
import User from "../../src/db/models/user.model";
import Review from "../../src/db/models/review.model";
import Appointment from "../../src/db/models/appointment.model";
import { getClinicTodayAnchor } from "../../src/utils/clinicDate";

/**
 * Doctor rating rules.
 *
 * Rating is deliberately gated on a completed visit so it can't be gamed, and
 * the list endpoint reports that gate as `canReview` so the UI can explain
 * itself instead of letting a patient fill in a form that will 403.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const TEST_USERS = {
  admin: { email: "test.review.admin@reperto.example", password: "Test@12345" },
  staff: { email: "test.review.staff@reperto.example", password: "Test@12345" },
  doctor: { email: "test.review.doctor@reperto.example", password: "Test@12345" },
  doctor2: { email: "test.review.doctor2@reperto.example", password: "Test@12345" },
  patient: { email: "test.review.patient@reperto.example", password: "Test@12345" },
  patient2: { email: "test.review.patient2@reperto.example", password: "Test@12345" },
} as const;

const tokens: Record<string, string> = {};
const userIds: Record<string, string> = {};

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
          name: `Test ${role}`,
          email,
          password: hashed,
          phone: "9999999999",
          gender: "other",
          dateOfBirth: new Date("1990-01-01"),
          bloodGroup: "O+",
          role:
            role === "patient" || role === "patient2"
              ? "patient"
              : role === "doctor" || role === "doctor2"
                ? "doctor"
                : role,
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
    tokens[role] = await login(role);
  }
});

beforeEach(async () => {
  await Review.deleteMany({});
  await Appointment.deleteMany({});
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

/**
 * A completed visit is the precondition for being allowed to rate.
 *
 * `slot` exists because appointments carry a unique
 * (doctorId, appointmentDate, timeSlot) index — two patients cannot share one
 * slot with the same doctor.
 */
const makeCompletedVisit = (
  patientId: string,
  doctorId: string,
  slot = "09:15",
) =>
  Appointment.create({
    patientId,
    doctorId,
    appointmentDate: getClinicTodayAnchor(),
    timeSlot: slot,
    durationInMinutes: 15,
    status: "completed",
    consultationType: "Initial",
    intakeDetails: {
      primaryComplaint: "Test complaint",
      duration: "2 weeks",
      currentMedication: "",
      pastMedicalHistory: "",
    },
  });

const makePendingVisit = (
  patientId: string,
  doctorId: string,
  slot = "10:30",
) =>
  Appointment.create({
    patientId,
    doctorId,
    appointmentDate: new Date(getClinicTodayAnchor().getTime() + DAY_MS),
    timeSlot: slot,
    durationInMinutes: 15,
    status: "pending",
    consultationType: "Follow-up",
    intakeDetails: {
      primaryComplaint: "Test complaint",
      duration: "2 weeks",
      currentMedication: "",
      pastMedicalHistory: "",
    },
  });

const listReviews = (doctorId: string, token: string) =>
  request(app)
    .get(`/api/review?doctorId=${doctorId}`)
    .set("Authorization", `Bearer ${token}`);

const rate = (token: string, doctorId: string, rating: number, comment?: string) =>
  request(app)
    .post("/api/review")
    .set("Authorization", `Bearer ${token}`)
    .send({ doctorId, rating, comment });

describe("doctor ratings", () => {
  it("lets a patient rate a doctor after a completed visit", async () => {
    await makeCompletedVisit(userIds.patient, userIds.doctor);

    const res = await rate(tokens.patient, userIds.doctor, 5, "Excellent care");
    expect(res.status).toBe(200);
    expect(res.body.data.rating).toBe(5);
    expect(res.body.data.comment).toBe("Excellent care");
  });

  it("blocks rating without a completed visit", async () => {
    // Booking ahead is not enough — only a finished appointment counts.
    await makePendingVisit(userIds.patient, userIds.doctor);

    const res = await rate(tokens.patient, userIds.doctor, 1, "Terrible");
    expect(res.status).toBe(403);

    const stored = await Review.countDocuments({ doctorId: userIds.doctor });
    expect(stored).toBe(0);
  });

  it("blocks a patient from rating a doctor they have never seen", async () => {
    const res = await rate(tokens.patient, userIds.doctor2, 5);
    expect(res.status).toBe(403);
  });

  it("blocks staff and doctors from leaving ratings", async () => {
    await makeCompletedVisit(userIds.patient, userIds.doctor);

    expect((await rate(tokens.staff, userIds.doctor, 5)).status).toBe(403);
    expect((await rate(tokens.doctor, userIds.doctor, 5)).status).toBe(403);
  });

  it("keeps one review per patient-doctor pair and updates it in place", async () => {
    await makeCompletedVisit(userIds.patient, userIds.doctor);

    await rate(tokens.patient, userIds.doctor, 3, "First impression");
    const second = await rate(tokens.patient, userIds.doctor, 5, "Changed my mind");

    expect(second.status).toBe(200);
    expect(second.body.data.rating).toBe(5);

    const reviews = await Review.find({ doctorId: userIds.doctor });
    expect(reviews).toHaveLength(1);
    expect(reviews[0].comment).toBe("Changed my mind");
  });

  it("rejects an out-of-range rating and a bad doctor id", async () => {
    await makeCompletedVisit(userIds.patient, userIds.doctor);

    expect((await rate(tokens.patient, userIds.doctor, 0)).status).toBe(400);
    expect((await rate(tokens.patient, userIds.doctor, 6)).status).toBe(400);
    expect((await rate(tokens.patient, "not-an-id", 4)).status).toBe(400);
  });

  it("rejects a rating for a non-doctor or unknown account", async () => {
    const notADoctor = await rate(tokens.patient, userIds.patient2, 5);
    expect(notADoctor.status).toBe(404);
  });

  describe("list endpoint", () => {
    it("returns the aggregate summary and distribution", async () => {
      await makeCompletedVisit(userIds.patient, userIds.doctor, "09:15");
      await makeCompletedVisit(userIds.patient2, userIds.doctor, "09:30");
      await rate(tokens.patient, userIds.doctor, 5);
      await rate(tokens.patient2, userIds.doctor, 4);

      const res = await listReviews(userIds.doctor, tokens.patient);
      expect(res.status).toBe(200);

      const { summary, reviews } = res.body.data;
      expect(summary.totalReviews).toBe(2);
      expect(summary.avgRating).toBe(4.5);
      expect(summary.distribution["5"]).toBe(1);
      expect(summary.distribution["4"]).toBe(1);
      expect(summary.distribution["1"]).toBe(0);
      expect(reviews).toHaveLength(2);
    });

    it("reports an empty summary for an unrated doctor", async () => {
      const res = await listReviews(userIds.doctor2, tokens.patient);
      expect(res.status).toBe(200);
      expect(res.body.data.summary).toMatchObject({
        avgRating: 0,
        totalReviews: 0,
      });
      expect(res.body.data.reviews).toEqual([]);
    });

    it("tells the patient whether they can rate", async () => {
      // No visit yet: the UI needs to know why the form will be closed.
      let res = await listReviews(userIds.doctor, tokens.patient);
      expect(res.body.data.canReview).toBe(false);
      expect(res.body.data.myReview).toBeNull();

      await makeCompletedVisit(userIds.patient, userIds.doctor);
      res = await listReviews(userIds.doctor, tokens.patient);
      expect(res.body.data.canReview).toBe(true);
    });

    it("still allows editing an existing review even without a live booking", async () => {
      await makeCompletedVisit(userIds.patient, userIds.doctor);
      await rate(tokens.patient, userIds.doctor, 4, "Good");

      // The completed visit is later cancelled; the patient keeps the ability
      // to edit or remove what they already wrote.
      await Appointment.updateMany(
        { patientId: userIds.patient, doctorId: userIds.doctor },
        { status: "cancelled" },
      );

      const res = await listReviews(userIds.doctor, tokens.patient);
      expect(res.body.data.canReview).toBe(true);
      expect(res.body.data.myReview).toMatchObject({ rating: 4, comment: "Good" });
    });

    it("never exposes canReview or another patient's review to staff", async () => {
      await makeCompletedVisit(userIds.patient, userIds.doctor);
      await rate(tokens.patient, userIds.doctor, 5);

      const res = await listReviews(userIds.doctor, tokens.staff);
      expect(res.status).toBe(200);
      expect(res.body.data.canReview).toBe(false);
      expect(res.body.data.myReview).toBeNull();
      // Staff still see the aggregate.
      expect(res.body.data.summary.totalReviews).toBe(1);
    });

    it("requires authentication", async () => {
      const res = await request(app).get(`/api/review?doctorId=${userIds.doctor}`);
      expect(res.status).toBe(401);
    });

    it("rejects a malformed doctor id", async () => {
      const res = await listReviews("nope", tokens.patient);
      expect(res.status).toBe(400);
    });
  });

  describe("delete", () => {
    it("lets a patient remove their own review only", async () => {
      await makeCompletedVisit(userIds.patient, userIds.doctor, "09:15");
      await rate(tokens.patient, userIds.doctor, 5);

      const res = await request(app)
        .delete(`/api/review/${userIds.doctor}`)
        .set("Authorization", `Bearer ${tokens.patient}`);
      expect(res.status).toBe(200);
      expect(await Review.countDocuments({ doctorId: userIds.doctor })).toBe(0);

      // A second attempt has nothing to delete.
      const again = await request(app)
        .delete(`/api/review/${userIds.doctor}`)
        .set("Authorization", `Bearer ${tokens.patient}`);
      expect(again.status).toBe(404);

      // Another patient can't remove someone else's review. The completed visit
      // from the start of this test is still in place, so reuse it.
      await rate(tokens.patient, userIds.doctor, 5);
      const other = await request(app)
        .delete(`/api/review/${userIds.doctor}`)
        .set("Authorization", `Bearer ${tokens.patient2}`);
      expect(other.status).toBe(404);
      expect(await Review.countDocuments({ doctorId: userIds.doctor })).toBe(1);
    });

    it("blocks staff from deleting reviews", async () => {
      await makeCompletedVisit(userIds.patient, userIds.doctor);
      await rate(tokens.patient, userIds.doctor, 5);

      const res = await request(app)
        .delete(`/api/review/${userIds.doctor}`)
        .set("Authorization", `Bearer ${tokens.staff}`);
      expect(res.status).toBe(403);
    });
  });
});
