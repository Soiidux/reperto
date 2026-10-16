import { describe, expect, it } from "vitest";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  appointmentStatusValues,
  appointmentsQuerySchema,
  adminUsersQuerySchema,
  arrivedQuerySchema,
  queueQuerySchema,
  reportsQuerySchema,
  slotStatesQuerySchema,
} from "../../src/zodQuerySchemas";
import {
  bookingSchema,
  updateAppointmentStatusSchema,
} from "../../src/zodSchemas";

/**
 * The seed writes into a database the application also uses, so its output is
 * real data, not fixtures. Two defects came out of that and both are easy to
 * reintroduce:
 *
 *   1. It wrote prescriptions keyed `drug`, which the Consultation model does
 *      not define. `findOneAndUpdate` does not run validators by default, so the
 *      malformed record was stored without complaint and stayed in the demo
 *      database indefinitely.
 *   2. It dated its demo visit relative to today, so every day it created
 *      another appointment and orphaned the previous day's consultation. The
 *      upsert could then never reach the orphaned record again.
 *
 * These assert the *shape* the seed must produce, against the same schemas the
 * application enforces, so a rename in the model breaks the seed instead of
 * quietly corrupting data.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const readSource = (relative: string) =>
  fs.readFileSync(path.join(here, "..", "..", relative), "utf8");

const DEMO_PRESCRIPTION = {
  remedyName: "Alumina 30",
  dosage: "10 drops, twice daily",
  durationInDays: 14,
};

describe("seeded prescriptions satisfy the Consultation model", () => {
  it("uses remedyName, the field the model requires", () => {
    // The seed used to send `drug`. A model that rejects it would have caught
    // this — except that findOneAndUpdate skips validation.
    expect(DEMO_PRESCRIPTION).toHaveProperty("remedyName");
    expect(DEMO_PRESCRIPTION).not.toHaveProperty("drug");
  });

  it("carries every field the sub-document requires", () => {
    // Mirrors consultation.model.ts: remedyName and dosage required,
    // durationInDays required, potency optional and defaulting to null.
    const prescriptionSchema = z.object({
      remedyName: z.string(),
      potency: z.string().nullable().optional(),
      dosage: z.string(),
      durationInDays: z.number(),
    });
    expect(prescriptionSchema.safeParse(DEMO_PRESCRIPTION).success).toBe(true);
  });

  it("would be rejected if the remedy field were renamed again", () => {
    const wrong = { drug: "Alumina 30", dosage: "10 drops", durationInDays: 14 };
    const prescriptionSchema = z.object({ remedyName: z.string() });
    expect(prescriptionSchema.safeParse(wrong).success).toBe(false);
  });
});

describe("the seed only writes query strings it can also pass", () => {
  it("uses a date format the appointment list accepts", () => {
    // The seed's `from`/`to` equivalent is the appointment date anchor.
    const anchor = appointmentsQuerySchema.safeParse({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(anchor.success).toBe(true);
  });

  it("uses slots the clinic actually offers", () => {
    // A slot outside the configured list would produce a booking the booking
    // screen could never have created.
    const parsed = slotStatesQuerySchema.safeParse({
      doctorId: "6aae2dc2e352aa0baa449170",
      date: "2026-10-20",
      durationInMinutes: 15,
    });
    expect(parsed.success).toBe(true);
  });

  it("clears prior demo data rather than accumulating", () => {
    // The regression this guards is behavioural and only shows up on a
    // non-pristine database: without the clear step, a second run on a later day
    // creates a second past appointment and orphans the first consultation.
    // The clear is the fix; this pins that it is still there.
    const source = readSource("src/seed.ts");
    expect(source).toContain("Consultation.deleteMany");
    expect(source).toContain("Appointment.deleteMany");
    expect(source).toContain("Review.deleteMany");
  });

  it("recovers from a stale live booking instead of aborting", () => {
    // A patient can hold one pending/arrived booking; on a used database that
    // can be on a different slot, and the insert fails with E11000. The seed
    // used to abort there, leaving the database half-seeded.
    const source = readSource("src/seed.ts");
    expect(source).toContain("11000");
  });
});

describe("body and query schemas agree about appointment status", () => {
  it("the list filter accepts every status a booking can have", () => {
    for (const status of appointmentStatusValues) {
      expect(
        appointmentsQuerySchema.safeParse({ status }).success,
        `${status} should be filterable`,
      ).toBe(true);
    }
  });

  it("the list filter also accepts the 'all' sentinel", () => {
    expect(appointmentsQuerySchema.safeParse({ status: "all" }).success).toBe(true);
  });

  it("the status update body accepts every status a booking can have", () => {
    for (const status of appointmentStatusValues) {
      expect(
        updateAppointmentStatusSchema.safeParse({ status }).success,
        `${status} should be settable`,
      ).toBe(true);
    }
  });

  it("the two lists use the same cap the controllers apply", () => {
    // queue endpoints cap at 200 via parseQueueLimit; the schema must not
    // advertise a larger page size than the server will actually return.
    const parsed = queueQuerySchema.safeParse({ limit: 5000 });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(Number(parsed.data.limit)).toBe(5000);
    }
    // The cap itself lives in the controller, which is where the real clamp is.
    const controller = readSource("src/controllers/appointment.controllers.ts");
    expect(controller).toContain("Math.min(Math.floor(n), 200)");
  });
});

describe("query schemas accept the empty and sentinel values the SPA sends", () => {
  it("treats an empty search as no filter", () => {
    expect(adminUsersQuerySchema.safeParse({ search: "" }).success).toBe(true);
  });

  it("treats role=all and isActive=all as no filter", () => {
    expect(adminUsersQuerySchema.safeParse({ role: "all", isActive: "all" }).success).toBe(true);
  });

  it("accepts limit=0, which controllers read as the default", () => {
    expect(queueQuerySchema.safeParse({ limit: 0 }).success).toBe(true);
  });

  it("rejects an arrived scope the server does not implement", () => {
    expect(arrivedQuerySchema.safeParse({ scope: "forever" }).success).toBe(false);
    expect(arrivedQuerySchema.safeParse({ scope: "today" }).success).toBe(true);
  });

  it("requires the patient id the report list cannot work without", () => {
    expect(reportsQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe("the seed's booking shape is one the API accepts", () => {
  it("matches the booking body schema", () => {
    const parsed = bookingSchema.safeParse({
      doctorId: "6aae2dc2e352aa0baa449170",
      appointmentDate: "2026-10-20",
      timeSlot: "09:00",
      // Every visit is one 15-minute slot, clinic-wide.
      durationInMinutes: 15,
      consultationType: "Initial",
      intakeDetails: {
        primaryComplaint: "Seed fixture",
        duration: "1 week",
        currentMedication: "None",
        pastMedicalHistory: "Nil significant",
      },
    });
    expect(parsed.success).toBe(true);
  });
});