import { z } from "zod";

const doctorProfileSchema = z
  .object({
    qualifications: z.array(z.string().trim()).optional(),
    experienceYears: z.number().min(0).optional(),
    specializations: z.array(z.string().trim()).optional(),
    languagesSpoken: z.array(z.string().trim()).optional(),
    consultationFee: z.number().min(0).optional(),
  })
  .optional();

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone: z
    .string()
    .trim()
    .length(10, "Phone number must be exactly 10 digits")
    .regex(/^\d+$/, "Phone number must contain only numbers"),
  gender: z.enum(["male", "female", "other"], "Please select a valid gender"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  bloodGroup: z.enum(
    ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    "Please select a valid blood group",
  ),
  role: z.enum(["patient", "doctor", "staff", "admin"]).optional(),
  doctorProfile: doctorProfileSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const bookingSchema = z.object({
  doctorId: z.string().min(1, "Select a doctor"),
  appointmentDate: z.string().min(1, "Select an appointment date"),
  timeSlot: z.string().min(1, "Select a time slot"),
  durationInMinutes: z.coerce
    .number()
    .int()
    .refine((v) => v === 15 || v === 30, "Select a duration in minutes"),
  consultationType: z.enum(["Initial", "Follow-up", "Acute"], "Select a consultation type"),
  intakeDetails: z.object({
    primaryComplaint: z.string().trim().min(1, "Enter a primary complaint"),
    duration: z.string().trim().min(1, "Enter a duration"),
    currentMedication: z.string().trim().min(1, "Enter current medication"),
    pastMedicalHistory: z.string().trim().min(1, "Enter past medical history"),
  }),
});

const modalitiesSchema = z.object({
  Aggravation: z.string().min(1, "Enter aggravation"),
  Amlioration: z.string().min(1, "Enter amlioration"),
});

export const consultationSchema = z.object({
  appointmentId: z.string().min(1, "Appointment is required"),
  chiefComplaintDetails: z.object({
    location: z.string().min(1, "Enter location"),
    sensation: z.string().min(1, "Enter sensation"),
    modalities: modalitiesSchema,
    concomitants: z.string().min(1, "Enter concomitants"),
  }),
  physicalGenerals: z
    .object({
      thermals: z.string().min(1).nullable().optional(),
      thirst: z.string().min(1).nullable().optional(),
      appetiteAndCravings: z.string().min(1).nullable().optional(),
      sleepAndDreams: z.string().min(1).nullable().optional(),
    })
    .optional(),
  mentalGenerals: z.string().min(1).nullable().optional(),
  pastMedicalHistory: z.string().min(1, "Enter past medical history"),
  diagnosis: z.string().min(1, "Enter diagnosis"),
  prescriptions: z.array(
    z.object({
      remedyName: z.string().min(1, "Enter remedy name"),
      potency: z.string().nullable().optional(),
      dosage: z.string().min(1, "Enter dosage"),
      durationInDays: z.coerce.number().positive("Duration must be greater than 0"),
    }),
  ),
  doctorNotes: z.string().min(1, "Enter doctor notes"),
});

export const addLeaveSchema = z.object({
  type: z.enum(["full-day", "half-day", "emergency"], "Select a leave type"),
  startingDate: z.string().min(1, "Select a starting date"),
  startingTime: z.string().optional(),
  endingDate: z.string().optional(),
  endingTime: z.string().optional(),
  reason: z.string().trim().optional().default("Personal Leave"),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(
    ["arrived", "completed", "cancelled", "no-show"],
    "Invalid status",
  ),
  reason: z.string().optional(),
  cancellationReason: z.string().optional(),
});