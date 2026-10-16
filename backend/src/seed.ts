import bcrypt from "bcrypt";
import mongoose from "mongoose";
import config from "./config";
import User from "./db/models/user.model";
import ClinicSettings from "./db/models/clinicSettings.model";
import Appointment from "./db/models/appointment.model";
import Consultation from "./db/models/consultation.model";
import Review from "./db/models/review.model";
import { buildDefaultSettings } from "./utils/clinicSettings";
import { getClinicTodayAnchor } from "./utils/clinicDate";
import { DEFAULT_DAY_SLOTS } from "./utils/clinicSettings";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A day's worth of demo activity, so a reviewer opening the app sees populated
 * dashboards instead of four empty shells: a patient with past consultations
 * (so medical history and reports are non-empty), a slot they can check in to
 * today, and a review to read on the doctor's card.
 *
 * Note the two patients rather than one: the schema enforces ONE live booking
 * (pending/arrived) per patient, so a clinic day with two live slots needs two
 * people.
 *
 * Re-seeding RESETS the demo data for these two accounts. That is deliberate,
 * and it fixes a real defect: the past visit is dated relative to today, so
 * every day the seed created another appointment 14 days back and left the
 * previous day's consultation orphaned in place. Re-running the seed over a
 * fortnight accumulated a duplicate history per patient, and a malformed record
 * written by an earlier version of this script stayed orphaned forever, because
 * the upsert could no longer reach it.
 *
 * Clearing first makes the seed idempotent over time rather than only on a
 * pristine database.
 */
const seedDemoActivity = async (doctor: any, patient: any, patient2: any) => {
  const today = getClinicTodayAnchor();
  const [firstSlot, secondSlot, thirdSlot] = DEFAULT_DAY_SLOTS;

  // Clear prior demo history for these two patients before rebuilding it.
  const demoPatients = [patient._id, patient2._id];
  await Consultation.deleteMany({ patientId: { $in: demoPatients } });
  await Appointment.deleteMany({ patientId: { $in: demoPatients } });
  await Review.deleteMany({ patientId: { $in: demoPatients } });

  // Past visit, already completed, with a consultation and a review attached.
  const pastDate = new Date(today.getTime() - 14 * DAY_MS);
  const pastAppointment = await Appointment.findOneAndUpdate(
    { patientId: patient._id, doctorId: doctor._id, appointmentDate: pastDate, timeSlot: firstSlot },
    {
      patientId: patient._id,
      doctorId: doctor._id,
      appointmentDate: pastDate,
      timeSlot: firstSlot,
      durationInMinutes: 15,
      status: "completed",
      consultationType: "Initial",
      intakeDetails: {
        primaryComplaint: "Recurring seasonal allergies for two years",
        duration: "2 years",
        currentMedication: "Antihistamine as needed",
        pastMedicalHistory: "Nil significant",
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  await Consultation.findOneAndUpdate(
    { appointmentId: pastAppointment._id },
    {
      patientId: patient._id,
      doctorId: doctor._id,
      appointmentId: pastAppointment._id,
      diagnosis: "Allergic rhinitis (perennial)",
      // Pending follow-up so the doctor's follow-up tracker has something real.
      prescriptions: [
        {
          // `remedyName`, not `drug` — the field the Consultation model
          // requires. `findOneAndUpdate` does not run validators by default, so
          // a wrong field name here writes a malformed prescription straight
          // past the schema instead of failing.
          remedyName: "Alumina 30",
          dosage: "10 drops, twice daily",
          durationInDays: 14,
        },
      ],
      followUpDate: new Date(),
      followUpStatus: "pending",
    },
    { upsert: true, returnDocument: "after" },
  );

  await Review.findOneAndUpdate(
    { patientId: patient._id, doctorId: doctor._id },
    {
      patientId: patient._id,
      doctorId: doctor._id,
      rating: 5,
      comment:
        "Very thorough consultation. Explained the treatment plan clearly and followed up the next day.",
    },
    { upsert: true, returnDocument: "after" },
  );

  // Today's schedule. Patient 1 is pending (bookable / check-in-able); patient 2
  // has already arrived, so the front-desk queue and the doctor's waiting room
  // both have rows.
  const todaysBookings: {
    person: any;
    slot: string;
    status: "pending" | "arrived";
  }[] = [
    { person: patient, slot: secondSlot, status: "pending" },
    { person: patient2, slot: thirdSlot, status: "arrived" },
  ];

  for (const { person, slot, status } of todaysBookings) {
    const filter = {
      patientId: person._id,
      doctorId: doctor._id,
      appointmentDate: today,
      timeSlot: slot,
    };
    const update = {
      patientId: person._id,
      doctorId: doctor._id,
      appointmentDate: today,
      timeSlot: slot,
      durationInMinutes: 15,
      status,
      consultationType: "Follow-up",
      ...(status === "arrived" ? { checkedInAt: new Date() } : {}),
      intakeDetails: {
        primaryComplaint: "Follow-up on allergy treatment",
        duration: "2 weeks",
        currentMedication: "Alumina 30",
        pastMedicalHistory: "Nil significant",
      },
    };

    // The schema allows one live booking (pending/arrived) per patient, enforced
    // by a partial unique index. A database that is not pristine — one this seed
    // has already run against, or one where a patient used the app — can hold a
    // live booking on a different slot, and the insert then fails with E11000.
    //
    // Previously that aborted the whole seed, leaving the database half-seeded:
    // a seed that only works on an empty database is not idempotent in any sense
    // a reviewer would recognise. Retire the stale booking and try again.
    try {
      await Appointment.findOneAndUpdate(filter, update, {
        upsert: true,
        returnDocument: "after",
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      await Appointment.deleteMany({
        patientId: person._id,
        status: { $in: ["pending", "arrived"] },
        $nor: [filter],
      });
      await Appointment.findOneAndUpdate(filter, update, {
        upsert: true,
        returnDocument: "after",
      });
    }
  }
};

const seed = async () => {
  try {
    await mongoose.connect(config.mongoUri);

    const salt = await bcrypt.genSalt(10);

    const adminPlainPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
    const doctorPlainPassword = process.env.SEED_DOCTOR_PASSWORD || "Doctor@123";
    const patientPlainPassword = process.env.SEED_PATIENT_PASSWORD || "Patient@123";
    const staffPlainPassword = process.env.SEED_STAFF_PASSWORD || "Staff@123";
    const adminPassword = await bcrypt.hash(adminPlainPassword, salt);
    const doctorPassword = await bcrypt.hash(doctorPlainPassword, salt);
    const patientPassword = await bcrypt.hash(patientPlainPassword, salt);
    const staffPassword = await bcrypt.hash(staffPlainPassword, salt);

    const admin = await User.findOneAndUpdate(
      { email: "admin@reperto.com" },
      {
        name: "System Admin",
        email: "admin@reperto.com",
        password: adminPassword,
        phone: "0000000000",
        gender: "other",
        dateOfBirth: new Date("1990-01-01"),
        bloodGroup: "O+",
        role: "admin",
        isActive: true,
        emailVerified: true,
      },
      { upsert: true, returnDocument: "after" },
    );

    const doctor = await User.findOneAndUpdate(
      { email: "doctor@reperto.com" },
      {
        name: "Dr. Sample Physician",
        email: "doctor@reperto.com",
        password: doctorPassword,
        phone: "1111111111",
        gender: "male",
        dateOfBirth: new Date("1985-06-15"),
        bloodGroup: "B+",
        role: "doctor",
        isActive: true,
        emailVerified: true,
        doctorProfile: {
          qualifications: ["BHMS", "MD (Homeopathy)"],
          experienceYears: 12,
          specializations: ["Chronic Diseases", "Pediatrics"],
          languagesSpoken: ["English", "Hindi"],
          consultationFee: 500,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    const patient = await User.findOneAndUpdate(
      { email: "patient@reperto.com" },
      {
        name: "Demo Patient",
        email: "patient@reperto.com",
        password: patientPassword,
        phone: "2222222222",
        gender: "female",
        dateOfBirth: new Date("1992-03-10"),
        bloodGroup: "O+",
        role: "patient",
        isActive: true,
        emailVerified: true,
      },
      { upsert: true, returnDocument: "after" },
    );

    const staff = await User.findOneAndUpdate(
      { email: "staff@reperto.com" },
      {
        name: "Reception Staff",
        email: "staff@reperto.com",
        password: staffPassword,
        phone: "3333333333",
        gender: "female",
        dateOfBirth: new Date("1998-08-25"),
        bloodGroup: "A+",
        role: "staff",
        isActive: true,
        emailVerified: true,
      },
      { upsert: true, returnDocument: "after" },
    );

    // A second patient exists because the schema allows only one live booking
    // per patient; today's demo schedule needs two distinct people.
    const patient2PlainPassword =
      process.env.SEED_PATIENT2_PASSWORD || "Patient@123";
    const patient2Password = await bcrypt.hash(patient2PlainPassword, salt);
    const patient2 = await User.findOneAndUpdate(
      { email: "patient2@reperto.com" },
      {
        name: "Demo Patient Two",
        email: "patient2@reperto.com",
        password: patient2Password,
        phone: "4444444444",
        gender: "male",
        dateOfBirth: new Date("1988-11-05"),
        bloodGroup: "O-",
        role: "patient",
        isActive: true,
        emailVerified: true,
      },
      { upsert: true, returnDocument: "after" },
    );

    // Clinic settings singleton with sane defaults (Sun closed, 9-1 + 2-4,
    // 2h cancellation window). Upsert only mints it when missing so admin
    // edits made via the UI are never clobbered by re-running the seed.
    const settingsDoc = await ClinicSettings.findOne();
    if (!settingsDoc) {
      await ClinicSettings.create(buildDefaultSettings());
      console.log("  Clinic   -> settings created with defaults");
    }

    // Demo activity, so a reviewer's first login shows real data. Skipped with
    // SEED_SKIP_ACTIVITY=1 when you only want the accounts.
    if (process.env.SEED_SKIP_ACTIVITY !== "1") {
      await seedDemoActivity(doctor, patient, patient2);
      console.log("  Demo     -> consultations, appointments and a review created");
    }

    console.log("Seed complete:");
    console.log(`  Admin   -> admin@reperto.com / ${adminPlainPassword} (${admin._id})`);
    console.log(`  Doctor  -> doctor@reperto.com / ${doctorPlainPassword} (${doctor._id})`);
    console.log(`  Patient -> patient@reperto.com / ${patientPlainPassword} (${patient._id})`);
    console.log(`  Patient2-> patient2@reperto.com / ${patient2PlainPassword} (${patient2._id})`);
    console.log(`  Staff   -> staff@reperto.com / ${staffPlainPassword} (${staff._id})`);
    console.log("Passwords can be overridden with SEED_ADMIN_PASSWORD, SEED_DOCTOR_PASSWORD,");
    console.log("SEED_PATIENT_PASSWORD, SEED_PATIENT2_PASSWORD and SEED_STAFF_PASSWORD.");
    console.log("SEED_SKIP_ACTIVITY=1 creates only the accounts.");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

seed();