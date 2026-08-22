import { Controller, useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  FieldLabel,
  Field,
  FieldError,
  FieldSet,
  FieldLegend,
  FieldSeparator,
} from "./ui/field";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { useNavigate, useParams } from "react-router-dom";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import type { consultationFormSchema } from "@/lib/zodSchemas";
import { consultationSchema } from "@/lib/zodSchemas";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import { getAppointmentById } from "@/api/appointment";
import { Calendar,VenusAndMars, Clock, User, Hourglass, NotepadText, CalendarClockIcon, LucideTimer, Pill, History } from "lucide-react";
import getAge from "@/utils/getAge";
import { createConsultation } from "@/api/consultation";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
interface Appointment {
  _id: string;
  patientId: {
    _id: string;
    name: string;
    gender: string;
    dateOfBirth: string;
    profileImageUrl?: string;
  } | string; // Polished to adapt if patientId is populated or raw ID string
  doctorId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
  } | string; // Polished to adapt if doctorId is populated or raw ID string
  appointmentDate: string;
  timeSlot: string;
  durationInMinutes: number;
  status: "pending" | "arrived" | "completed" | "cancelled" | "no-show";
  consultationType: 'Initial' | 'Follow-up' | 'Acute';
  intakeDetails: {
    primaryComplaint: string;
    duration: string;
    currentMedication: string;
    pastMedicalHistory: string;
  }
  cancellationReason: string;
};

export default function ConsultationForm() {
  const { user } = useAuthStore();
  
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<consultationFormSchema>({
    resolver: zodResolver(consultationSchema),
    defaultValues: {
      physicalGenerals: {
        thermals: null,
        thirst: null,
        appetiteAndCravings: null,
        sleepAndDreams: null,
      },
      mentalGenerals: null,
      prescriptions: [
        {
          remedyName: "",
          potency: "",
          dosage: "",
          durationInDays: 1,
        },
      ],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "prescriptions",
  });
  const navigate = useNavigate();
  const [appointmentData, setAppointmentData] = useState<Appointment | undefined>(undefined);
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    try {
      const fetchAppointment = async () => {
        if (!id) return;
        const response = await getAppointmentById(id);
        setAppointmentData(response.data.data);
        setValue("pastMedicalHistory", response.data.data.intakeDetails.pastMedicalHistory);
      };
      fetchAppointment();
    } catch (error) {
      console.error(error);
    }
    }, [id, setValue]);
  const onSubmit = async (formData: consultationFormSchema) => {
    try {
      const response = await createConsultation({ ...formData, appointmentId: id! });
      if (response.data.success) {
        toast.success("Consultation saved. Appointment marked as completed.");
        navigate(`/doctor/appointments`);
      }
    } catch (err: unknown) {
      console.log("Raw submission rejection payload:", err); // 🚀 Add this!
      const serverErrorMessage =
        getErrorMessage(err, "Internal Server Error");
      toast.error(serverErrorMessage);
    }
  };
  // On invalid submit, bring the first unfilled required field into view
  const onInvalid = () => {
    requestAnimationFrame(() => {
      const firstInvalid = document.querySelector<HTMLElement>('[data-invalid="true"]');
      if (!firstInvalid) return;
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      firstInvalid
        .querySelector<HTMLElement>("textarea, input, select")
        ?.focus({ preventScroll: true });
      toast.error("Please fill all required fields marked with *");
    });
  };
  if (!appointmentData) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
        <Card className="w-full shadow-md border-neutral-100">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-3xl font-bold tracking-tight text-neutral-900">
                Fill the Consultation Form
              </CardTitle>
              <CardDescription className="text-center text-neutral-500">
                Loading...
              </CardDescription>
            </CardHeader>
        </Card>
      </div>
    )
  }
  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
      <Card className="w-full shadow-md border-neutral-100">
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col gap-6">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-3xl font-bold tracking-tight text-neutral-900">
              Fill the Consultation Form
            </CardTitle>
            <CardDescription className="text-center text-neutral-500">
              <p>Please fill out the form below to complete consultation.</p>
              <p>Fields marked with <span className="text-destructive font-bold">*</span> are required.</p>
              <p className="font-semibold">Consultation for Appointment Id: {id}</p>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <FieldSeparator className="my-2 border-neutral-100" />
            <FieldSet className="space-y-4">
              <FieldLegend className="flex items-center justify-between text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
                Patient Information
                {appointmentData && typeof appointmentData.patientId !== "string" && (
                  <Link
                    to={`/${user!.role}/consultation/history/${appointmentData.patientId._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="
                      inline-flex items-center justify-center
                      rounded-md px-4 py-2
                      text-sm font-medium
                      bg-primary text-primary-foreground
                      hover:bg-primary/90
                      transition-colors
                    "
                  >
                    Consultation History
                  </Link>
                )}
              </FieldLegend>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Name */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <User className="w-5 h-5 text-neutral-400 shrink-0" />
              
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Name
                    </span>
              
                    {appointmentData &&
                      typeof appointmentData.patientId !== "string" && (
                        <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                          {appointmentData.patientId.name}
                        </span>
                    )}
                  </div>
                </div>
              
                {/* Age */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <Calendar className="w-5 h-5 text-neutral-400 shrink-0" />
              
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Age
                    </span>
              
                    {appointmentData &&
                      typeof appointmentData.patientId !== "string" && (
                        <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                          {getAge(appointmentData.patientId.dateOfBirth)}
                        </span>
                    )}
                  </div>
                </div>
              
                {/* Gender */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <VenusAndMars className="w-5 h-5 text-neutral-400 shrink-0" />
              
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Gender
                    </span>
              
                    {appointmentData &&
                      typeof appointmentData.patientId !== "string" && (
                        <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                          {appointmentData.patientId.gender.charAt(0).toUpperCase() +
                            appointmentData.patientId.gender.slice(1)}
                        </span>
                    )}
                  </div>
                </div>
              </div>
            </FieldSet>
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
                Appointment Details
              </FieldLegend>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Date */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <CalendarClockIcon className="w-5 h-5 text-neutral-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Date
                    </span>              
                    {appointmentData &&
                      typeof appointmentData.patientId !== "string" && (
                        <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                          {new Date(appointmentData.appointmentDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "UTC",
                          })}
                        </span>
                    )}
                  </div>
                </div>
              
                {/* Time */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <Clock className="w-5 h-5 text-neutral-400 shrink-0" />
              
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Time Slot
                    </span>
              
                    {appointmentData &&
                      typeof appointmentData.patientId !== "string" && (
                        <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                          {appointmentData.timeSlot}
                        </span>
                    )}
                  </div>
                </div>
              
                {/* Duration */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <Hourglass className="w-5 h-5 text-neutral-400 shrink-0" />
              
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Appointment Duration
                    </span>
              
                    {appointmentData &&
                      typeof appointmentData.patientId !== "string" && (
                        <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                          {appointmentData.durationInMinutes} minutes
                        </span>
                    )}
                  </div>
                </div>
              </div>
            </FieldSet>
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
                Intake Details
              </FieldLegend>
              <div className="grid grid-cols-1 gap-6">
                {/* Primary Complaint */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <NotepadText className="w-5 h-5 text-neutral-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Primary Complaint
                    </span>              
                    {appointmentData &&
                      typeof appointmentData.patientId !== "string" && (
                        <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                          {appointmentData.intakeDetails.primaryComplaint};
                        </span>
                    )}
                  </div>
                </div>
              
                {/* Duration of Problem */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <LucideTimer className="w-5 h-5 text-neutral-400 shrink-0" />
              
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Duration of Problem
                    </span>
              
                    {appointmentData &&
                      typeof appointmentData.patientId !== "string" && (
                        <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                          {appointmentData.intakeDetails.duration}
                        </span>
                    )}
                  </div>
                </div>
              
                {/* Current Medication */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <Pill className="w-5 h-5 text-neutral-400 shrink-0" />
              
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Current Medication
                    </span>
              
                    {appointmentData &&
                      typeof appointmentData.patientId !== "string" && (
                        <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                          {appointmentData.intakeDetails.currentMedication}
                        </span>
                    )}
                  </div>
                </div>
                {/* Past Medical History */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <History className="w-5 h-5 text-neutral-400 shrink-0" />
              
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Past Medical History
                    </span>
              
                    {appointmentData &&
                      typeof appointmentData.patientId !== "string" && (
                        <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                          {appointmentData.intakeDetails.pastMedicalHistory}
                        </span>
                    )}
                  </div>
                </div>
              </div>
            </FieldSet>
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
               Chief Complaint Details
              </FieldLegend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <Controller
                  name="chiefComplaintDetails.location"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Location <span className="text-destructive">*</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Head, Upper Abdomin, Lower Abdomin, Finger, etc."
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="chiefComplaintDetails.sensation"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Sensation <span className="text-destructive">*</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Burning, Pricking, Stinging, Tearing, etc."
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="chiefComplaintDetails.modalities.Aggravation"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Aggravation <span className="text-destructive">*</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Bending, Walking, Standing, etc."
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="chiefComplaintDetails.modalities.Amlioration"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Amlioration <span className="text-destructive">*</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Pressure, warmth, lying down  etc."
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="chiefComplaintDetails.concomitants"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Concomitants <span className="text-destructive">*</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Nausea, Pain, Vertigo, Heartburn etc."
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </FieldSet>
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
               Past Medical History
              </FieldLegend>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4">
                <Controller
                  name="pastMedicalHistory"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Past Medical History <span className="text-destructive">*</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="High BP, Virtigo, etc."
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </FieldSet>
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
               Physical Generals
              </FieldLegend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <Controller
                  name="physicalGenerals.thermals"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Thermals <span className="text-neutral-400 font-normal">(optional)</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Hot, Ambithermal, Cold etc."
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="physicalGenerals.thirst"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Thirst <span className="text-neutral-400 font-normal">(optional)</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="1L, 2L, 1-2 Glasses etc."
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="physicalGenerals.appetiteAndCravings"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Appetite and Cravings <span className="text-neutral-400 font-normal">(optional)</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Changes in appetite and cravings(like sweet,sour,savory,etc.)"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="physicalGenerals.sleepAndDreams"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Sleep and Dreams <span className="text-neutral-400 font-normal">(optional)</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Quality of sleep(disturbed, sound), Types of dreams etc."
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </FieldSet>
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
               Mental Generals
              </FieldLegend>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4">
                <Controller
                  name="mentalGenerals"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Mental Generals <span className="text-neutral-400 font-normal">(optional)</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Mood, Nature, Weeps, Irritability, Anger, Anxiety etc."
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </FieldSet>
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
               Diagnosis
              </FieldLegend>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4">
                <Controller
                  name="diagnosis"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Diagnosis <span className="text-destructive">*</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Diabetes, Thyroid, Arthritis etc."
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </FieldSet>
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
                Prescriptions
              </FieldLegend>
              {fields.map((item, index) => (
                <div
                  key={item.id}
                  className="space-y-4 rounded-lg border p-4 grid grid-cols-1 md:grid-cols-2 gap-2"
                >
                  <Controller
                    name={`prescriptions.${index}.remedyName`}
                    control={control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>
                          Remedy Name <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                          {...field}
                          placeholder="Arnica Montana"
                        />
                      </Field>
                    )}
                  />
                  <Controller
                    name={`prescriptions.${index}.potency`}
                    control={control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>
                          Potency <span className="text-neutral-400 font-normal">(optional)</span>
                        </FieldLabel>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="30C"
                        />
                      </Field>
                    )}
                  />
                  <Controller
                    name={`prescriptions.${index}.dosage`}
                    control={control}
                    render={({ field }) => (
                      <Field>
                        <FieldLabel>
                          Dosage <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                          {...field}
                          placeholder="4 pills, 3 times a day"
                        />
              
                      </Field>
                    )}
                  />
                  <Controller
                    name={`prescriptions.${index}.durationInDays`}
                    control={control}
                    render={({ field }) => (
            
                      <Field>
                        <FieldLabel>
                          Duration (days) <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                          type="number"
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </Field>
                    )}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => remove(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            
              <Button
                type="button"
                onClick={() =>
                  append({
                    remedyName: "",
                    potency: "",
                    dosage: "",
                    durationInDays: 1,
                  })
                }
              >
                Add Prescription
              </Button>         
            </FieldSet>
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
               Doctor Notes
              </FieldLegend>
              <div className="grid grid-cols-1 gap-x-6 gap-y-4">
                <Controller
                  name="doctorNotes"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field
                      data-invalid={fieldState.invalid}
                      className="flex flex-col gap-1.5"
                    >
                      <FieldLabel
                        className="font-semibold text-neutral-700"
                        htmlFor={field.name}
                      >
                        Doctor Notes <span className="text-destructive">*</span>
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Patient Improvements, Remarks, Analysis on Medicine , Suggestions etc."
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </FieldSet>
          </CardContent>
          <CardFooter className="flex justify-center items-center">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-1/2 md:w-1/3 py-5 font-bold shadow-sm"
            >
              Complete Consultation
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
