import bcrypt from "bcrypt";
import mongoose from "mongoose";
import config from "./config";
import User from "./db/models/user.model";

const seed = async () => {
  try {
    await mongoose.connect(config.mongoUri);

    const salt = await bcrypt.genSalt(10);

    const adminPassword = await bcrypt.hash("Admin@123", salt);
    const doctorPassword = await bcrypt.hash("Doctor@123", salt);

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
      },
      { upsert: true, new: true },
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
        doctorProfile: {
          qualifications: ["BHMS", "MD (Homeopathy)"],
          experienceYears: 12,
          specializations: ["Chronic Diseases", "Pediatrics"],
          languagesSpoken: ["English", "Hindi"],
          consultationFee: 500,
        },
      },
      { upsert: true, new: true },
    );

    console.log("Seed complete:");
    console.log(`  Admin  -> admin@reperto.com / Admin@123 (${admin._id})`);
    console.log(`  Doctor -> doctor@reperto.com / Doctor@123 (${doctor._id})`);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

seed();