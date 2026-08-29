import mongoose from "mongoose";
import config from "../src/config";
import User from "../src/db/models/user.model";
import Appointment from "../src/db/models/appointment.model";
import Consultation from "../src/db/models/consultation.model";

async function main() {
  await mongoose.connect(config.mongoUri);
  const patient = await User.findOne({ email: process.argv[2] });
  const doctor = await User.findOne({ role: "doctor" });
  if (!patient) throw new Error("patient not found");
  if (!doctor) throw new Error("no doctor");
  const appointment = await Appointment.create({
    patientId: patient._id,
    doctorId: doctor._id,
    appointmentDate: new Date(Date.now() + 86400000),
    timeSlot: "11:00",
    durationInMinutes: 30,
    status: "completed",
    consultationType: "Initial",
    intakeDetails: {
      primaryComplaint: "Chronic headache",
      duration: "3 weeks",
      currentMedication: "none",
      pastMedicalHistory: "none",
    },
  });
  const consultation = await Consultation.create({
    appointmentId: appointment._id,
    patientId: patient._id,
    doctorId: doctor._id,
    chiefComplaintDetails: {
      location: "Temples",
      sensation: "Throbbing",
      modalities: { Aggravation: "Noise", Amlioration: "Rest" },
      concomitants: "Nausea",
    },
    physicalGenerals: { thermals: "Chilly", thirst: "Less", appetiteAndCravings: "Frequent", sleepAndDreams: "Disturbed" },
    mentalGenerals: "Anxious before episodes.",
    pastMedicalHistory: "Non-contributory",
    diagnosis: "Tension-type headache",
    prescriptions: [
      { remedyName: "Belladonna", potency: "30C", dosage: "3 globules, thrice daily", durationInDays: 14 },
      { remedyName: "Gelsemium", potency: "200C", dosage: "3 globules, twice daily", durationInDays: 10 },
    ],
    doctorNotes: "Review after course. Hydration and posture.",
  });
  console.log("seeded consultation", consultation._id.toString());
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});