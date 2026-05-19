import { Controller, useForm, useWatch } from "react-hook-form";
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
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useNavigate } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { useDoctorStore } from "@/store/doctorStore";
import { getAvailableSlots } from "@/api/appointment";
import type { appointmentFormSchema } from "@/lib/zodSchemas";
import { appointmentSchema } from "@/lib/zodSchemas";
import { bookAppointment } from "@/api/appointment";
import { toast } from "sonner";
import { useAuthStore } from "@/store/authStore";

export default function AppointmentForm() {
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isSubmitting },
  } = useForm<appointmentFormSchema>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      doctorId: "",
      appointmentDate: "",
      durationInMinutes: "30",
      consultationType: "Initial",
    },
  });
  const consultationType = useWatch({ control, name: "consultationType" });
  const doctorId = useWatch({ control, name: "doctorId" });
  const appointmentDate = useWatch({ control, name: "appointmentDate" });
  const durationInMinutes = useWatch({ control, name: "durationInMinutes" });
  const { doctors } = useDoctorStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [freeSlots, setFreeSlots] = useState<string[]>([]);
  const [isSlotsLoading, setIsSlotsLoading] = useState(true);
  const { user } = useAuthStore();
  useEffect(() => {
    if (consultationType) {
      const duration = consultationType === "Initial" ? "30" : "15";
      setValue("durationInMinutes", duration, { shouldValidate: true });
    }
  }, [consultationType, setValue]);
  useEffect(() => {
    try {
      if (doctorId && appointmentDate && durationInMinutes) {
        async function fetchSlots() {
          const response = await getAvailableSlots(doctorId, appointmentDate, durationInMinutes)
          if (response.success) {
            setFreeSlots(response.data);
          }
          setIsSlotsLoading(false);
        }
        fetchSlots();
      }
    } catch (error) {
      console.error(error);
      setFreeSlots([]);
      setIsSlotsLoading(false);
    }
    }, [doctorId, appointmentDate, durationInMinutes]);
  const onSubmit = async (formData: appointmentFormSchema) => {
    try {
      const response = await bookAppointment(formData);
      if (response.data.success) {
        toast.success("Appointment booked successfully!");
        navigate(`/${user.role}/dashboard`);
      }
      
    }catch (err: unknown) {
      console.log("Raw submission rejection payload:", err); // 🚀 Add this!
      const serverErrorMessage = (err as any)?.response?.data?.message || "Internal Server Error";
      toast.error(serverErrorMessage);
    }
  };



  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
      <Card className="w-full shadow-md border-neutral-100">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-3xl font-bold tracking-tight text-neutral-900">
              Book an Appointment
            </CardTitle>
            <CardDescription className="text-center text-neutral-500">
              Kindly fill in the form below to book an appointment.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
                Appointment Details
              </FieldLegend>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-4">
                <Controller
                  name="doctorId"
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
                        Doctor
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                        defaultValue={field.value || ""}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-invalid={fieldState.invalid}
                        >
                          <SelectValue placeholder="Select doctor" />
                        </SelectTrigger>
                        <SelectContent>
                          {doctors.map((doctor) => (
                            <SelectItem key={doctor._id} value={doctor._id}>
                              {doctor.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="appointmentDate"
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
                        Appointment Date
                      </FieldLabel>
                      <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            id={field.name}
                            type="button"
                            aria-invalid={fieldState.invalid}
                            className="w-full justify-start font-normal bg-transparent rounded-md border border-input text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
                          >
                            {field.value ? field.value : <span className="text-muted-foreground">Select date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            // Appends a safe local time string space so formatting parses the exact date typed
                            selected={field.value ? new Date(`${field.value}T12:00:00`) : undefined}
                            defaultMonth={field.value ? new Date(`${field.value}T12:00:00`) : undefined}
                            captionLayout="dropdown"
                            onSelect={(selectedDate) => {
                              if (selectedDate) {
                                // 🚀 Extract the year, month, and day based on the user's local timezone
                                const year = selectedDate.getFullYear();
                                const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
                                const day = String(selectedDate.getDate()).padStart(2, "0");
                                
                                field.onChange(`${year}-${month}-${day}`);
                                setOpen(false); // Cleanly close popover overlay upon selection
                              } else {
                                field.onChange("");
                              }
                            }}
                            disabled={(date) =>
                              date < new Date(new Date().setHours(0, 0, 0, 0)) || date < new Date("1900-01-01")
                            }
                          />
                        </PopoverContent>
                      </Popover>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="consultationType"
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
                        Consultation Type
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                        defaultValue={field.value || ""}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-invalid={fieldState.invalid}
                        >
                          <SelectValue placeholder="Select Consultation Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Initial">Initial</SelectItem>
                          <SelectItem value="Follow-up">Follow-up</SelectItem>
                          <SelectItem value="Acute">Acute</SelectItem>
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="durationInMinutes"
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
                        Duration in Minutes
                      </FieldLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                        defaultValue={field.value || ""}
                        disabled={true}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-invalid={fieldState.invalid}
                          disabled
                        >
                          <SelectValue placeholder="Auto-set based on type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="timeSlot"
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
                        Time Slot
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                        defaultValue={field.value || ""}
                        disabled={isSlotsLoading || freeSlots.length === 0}
                      >
                        <SelectTrigger
                          className="w-full"
                          aria-invalid={fieldState.invalid}
                        >
                          <SelectValue placeholder="Select time slot" />
                        </SelectTrigger>
                        <SelectContent>
                          {freeSlots.map((slot) => (
                            <SelectItem key={slot} value={slot}>
                              {slot}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </div>
            </FieldSet>
            <FieldSeparator className="my-2 border-neutral-100" />
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
                Intake Details
              </FieldLegend>
              <div className="grid grid-cols-1 gap-6 items-start">
                <Controller
                  name="intakeDetails.primaryComplaint"
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
                        Primary Complaint
                      </FieldLabel>
                      {/* Fixed: Pass value, defaultValue, and onValueChange to map Radix state correctly */}
                      <Textarea
                        id={field.name}
                        name={field.name}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Enter primary complaint"
                      />
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
                <Controller
                  name="intakeDetails.duration"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="flex flex-col gap-1.5">
                      <FieldLabel className="font-semibold text-neutral-700" htmlFor={field.name}>Duration</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="e.g: 2 days, 3 weeks, 6 months"
                        type="text"
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="intakeDetails.currentMedication"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="flex flex-col gap-1.5">
                      <FieldLabel className="font-semibold text-neutral-700" htmlFor={field.name}>Current Medication</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="e.g: Aspirin, Ibuprofen, etc."
                        type="text"
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="intakeDetails.pastMedicalHistory"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="flex flex-col gap-1.5">
                      <FieldLabel className="font-semibold text-neutral-700" htmlFor={field.name}>Past Medical History</FieldLabel>
                      <Input
                        {...field}
                        id={field.name}
                        placeholder="e.g: Diabetes, Hypertension, etc."
                        type="text"
                        className="w-full"
                        aria-invalid={fieldState.invalid}
                        autoComplete="off"
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
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
              Book Appointment
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
