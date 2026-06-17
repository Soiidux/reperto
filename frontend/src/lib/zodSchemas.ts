import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = z.object({
  name: z.string({ message: "Name is required" }),
  email: z
    .string({ message: "Email is required" })
    .email({ message: "Invalid email address" }),
  password: z
    .string({ message: "Password is required" })
    .min(8, { message: "Password must be at least 8 characters" }),
  phone: z
    .string({ message: "Phone number is required" })
    .length(10, { message: "Phone number must be exactly 10 digits" })
    .regex(/^\d+$/, { message: "Phone number must contain only numbers" }),
  gender: z.enum(["male", "female", "other"], {
    message: "Please select a valid gender",
  }),
  dateOfBirth: z.string({ message: "Date of birth is required" }),
  bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], {
    message: "Please select a valid blood group",
  }),
});

export const appointmentSchema = z.object({
  doctorId: z
    .string({ message: "Select a doctor" })
    .min(1, { message: "Select a doctor" }),
  appointmentDate: z
    .string({ message: "Select an appointment date" })
    .min(1, { message: "Select an appointment date" }),
  timeSlot: z
    .string({ message: "Select a time slot" })
    .min(1, { message: "Select a time slot" }),
  durationInMinutes: z.enum(["15", "30"], {
    message: "Select a duration in minutes",
  }),
  consultationType: z.enum(["Initial", "Follow-up", "Acute"], {
    message: "Select a consultation type",
  }),
  intakeDetails: z.object({
    primaryComplaint: z
      .string({ message: "Enter a primary complaint" })
      .min(1, { message: "Enter a primary complaint" }),
    duration: z
      .string({ message: "Enter a duration" })
      .min(1, { message: "Enter a duration" }),
    currentMedication: z
      .string({ message: "Enter current medication" })
      .min(1, { message: "Enter current medication" }),
    pastMedicalHistory: z
      .string({ message: "Enter past medical history" })
      .min(1, { message: "Enter past medical history" }),
  }),
});

export const consultationSchema = z.object({
  chiefComplaintDetails: z.object({
    location: z.string("Enter location").min(1, "Enter location"),

    sensation: z.string("Enter sensation").min(1, "Enter sensation"),

    modalities: z.object({
      Aggravation: z.string("Enter aggravation").min(1, "Enter aggravation"),
      Amlioration: z.string("Enter amlioration").min(1, "Enter amlioration"),
    }),

    concomitants: z.string("Enter concomitants").min(1, "Enter concomitants"),
  }),

  physicalGenerals: z.object({
    thermals: z.string("Enter thermals").min(1, "Enter thermals").nullable().optional(),

    thirst: z.string("Enter thirst").min(1, "Enter thirst").nullable().optional(),

    appetiteAndCravings: z
      .string("Enter appetite and cravings")
      .min(1, "Enter appetite and cravings")
      .nullable()
      .optional(),

    sleepAndDreams: z
      .string("Enter sleep and dreams")
      .min(1, "Enter sleep and dreams")
      .nullable()
      .optional(),
  }),

  mentalGenerals: z
    .string("Enter mental generals")
    .min(1, "Enter mental generals")
    .nullable()
    .optional(),

  pastMedicalHistory: z.string("Enter past medical history").min(1, "Enter past medical history"),

  diagnosis: z.string("Enter diagnosis").min(1, "Enter diagnosis"),

  prescriptions: z.array(
    z.object({
      remedyName: z.string("Enter remedy name").min(1, "Enter remedy name"),

      potency: z.string().nullable().optional(),

      dosage: z.string("Enter dosage").min(1, "Enter dosage"),

      durationInDays: z
        .number()
        .positive("Duration must be greater than 0"),
    }),
  ),

  doctorNotes: z.string("Enter doctor notes").min(1, "Enter doctor notes"),
});

export type appointmentFormSchema = z.infer<typeof appointmentSchema>;
export type loginFormSchema = z.infer<typeof loginSchema>;
export type registerFormSchema = z.infer<typeof registerSchema>;
export type consultationFormSchema = z.infer<typeof consultationSchema>;
