import bcrypt from "bcrypt";
import mongoose from "mongoose";
import config from "./config";
import User from "./db/models/user.model";
import ClinicSettings from "./db/models/clinicSettings.model";
import { buildDefaultSettings } from "./utils/clinicSettings";

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

    // Clinic settings singleton with sane defaults (Sun closed, 9-1 + 2-4,
    // 2h cancellation window). Upsert only mints it when missing so admin
    // edits made via the UI are never clobbered by re-running the seed.
    const settingsDoc = await ClinicSettings.findOne();
    if (!settingsDoc) {
      await ClinicSettings.create(buildDefaultSettings());
      console.log("  Clinic   -> settings created with defaults");
    }

    console.log("Seed complete:");
    console.log(`  Admin   -> admin@reperto.com / ${adminPlainPassword} (${admin._id})`);
    console.log(`  Doctor  -> doctor@reperto.com / ${doctorPlainPassword} (${doctor._id})`);
    console.log(`  Patient -> patient@reperto.com / ${patientPlainPassword} (${patient._id})`);
    console.log(`  Staff   -> staff@reperto.com / ${staffPlainPassword} (${staff._id})`);
    console.log("Passwords can be overridden with SEED_ADMIN_PASSWORD, SEED_DOCTOR_PASSWORD,");
    console.log("SEED_PATIENT_PASSWORD and SEED_STAFF_PASSWORD.");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

seed();