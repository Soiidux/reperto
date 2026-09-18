import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { getErrorMessage } from "@/lib/utils";
import { appointmentSchema } from "@/lib/zodSchemas";
import { getFamilyMembers, type FamilyMember } from "@/api/user";
import {
  createHold,
  bookFromHold,
  releaseHold,
  getSlotStates,
  getAppointmentTicketQrUrl,
  downloadAppointmentTicket,
  type SlotStateInfo,
} from "@/api/appointment";
import { useAuthStore } from "@/store/authStore";
import { useDoctorStore } from "@/store/doctorStore";

type ConsultationType = "Initial" | "Follow-up" | "Acute";

const detailsSchema = appointmentSchema.pick({ intakeDetails: true });
type DetailsForm = z.infer<typeof detailsSchema>;

// Movie-style booking: the patient picks a time chip ("seat"), the slot is
// held for 5 minutes while they fill in details, then the hold converts into
// a confirmed appointment ticket. The chip grid refreshes itself every 30s,
// on window focus, and after every action so "taken" slots show up fast.
export default function BookingWizard({
  defaultDoctorId = "",
  defaultType = "Initial",
}: {
  defaultDoctorId?: string;
  defaultType?: ConsultationType;
}) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { doctors, fetchDoctors } = useDoctorStore();

  const [step, setStep] = useState(0);
  const [doctorId, setDoctorId] = useState(defaultDoctorId);
  const [dateStr, setDateStr] = useState("");
  const [consultationType, setConsultationType] = useState<ConsultationType>(defaultType);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [slots, setSlots] = useState<SlotStateInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [hold, setHold] = useState<{ id: string; timeSlot: string; expiresAt: number } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [bookedAppointment, setBookedAppointment] = useState<any>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [dateOpen, setDateOpen] = useState(false);

  const duration = consultationType === "Initial" ? "30" : "15";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      intakeDetails: {
        primaryComplaint: "",
        duration: "",
        currentMedication: "",
        pastMedicalHistory: "",
      },
    },
  });

  // Doctors + family members for the first step
  useEffect(() => {
    if (doctors.length === 0) fetchDoctors();
  }, [doctors.length, fetchDoctors]);

  useEffect(() => {
    let active = true;
    getFamilyMembers()
      .then((response) => {
        if (active) {
          setFamilyMembers((response.data?.data ?? []).filter((m: FamilyMember) => m.isActive));
        }
      })
      .catch(() => {
        if (active) setFamilyMembers([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Free an abandoned hold if the patient leaves the page mid-booking
  const holdRef = useRef(hold);
  useEffect(() => {
    holdRef.current = hold;
  }, [hold]);
  useEffect(() => {
    return () => {
      if (holdRef.current) releaseHold(holdRef.current.id).catch(() => {});
    };
  }, []);

  const releaseCurrentHold = useCallback(async () => {
    const current = holdRef.current;
    if (!current) return;
    try {
      await releaseHold(current.id);
    } catch {
      // Expired or already released server-side — nothing to do
    }
    holdRef.current = null;
    setHold(null);
    setSecondsLeft(0);
  }, []);

  const loadSlots = useCallback(async () => {
    if (!doctorId || !dateStr) return;
    setSlotsLoading(true);
    try {
      const res = await getSlotStates({
        doctorId,
        date: dateStr,
        durationInMinutes: duration,
      });
      const list: SlotStateInfo[] = res.data?.success ? res.data?.data ?? [] : [];
      setSlots(list);
      // If our hold vanished server-side (expired/released), forget it locally
      setHold((h) => {
        if (!h) return h;
        return list.some((s) => s.state === "held-by-me") ? h : null;
      });
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [doctorId, dateStr, duration]);

  // Refresh on entry to the time-chip step, then every 30s + on window focus
  useEffect(() => {
    if (step !== 1) return;
    if (!doctorId || !dateStr) return;
    loadSlots();
    const timer = setInterval(loadSlots, 30_000);
    const onFocus = () => loadSlots();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [step, loadSlots]);

  // Held-slot countdown
  useEffect(() => {
    if (!hold) {
      if (secondsLeft !== 0) setSecondsLeft(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.floor((hold.expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        // Free the hold on the server right away (the TTL sweep also handles
        // it, but that can take ~60s) so the chip opens up for a re-tap.
        releaseHold(hold.id).catch(() => {});
        setHold((h) => (h && h.id === hold.id ? null : h));
        toast.info("Your slot hold expired — it's free again");
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [hold?.id, hold?.expiresAt]);

  // Changing doctor/date/type invalidates any held slot
  const changeDoctor = (id: string) => {
    if (id !== doctorId) {
      releaseCurrentHold();
      setDoctorId(id);
      setSlots([]);
    }
  };
  const changeDate = (date: string) => {
    if (date !== dateStr) {
      releaseCurrentHold();
      setDateStr(date);
      setSlots([]);
    }
  };
  const changeType = (type: ConsultationType) => {
    if (type !== consultationType) {
      releaseCurrentHold();
      setConsultationType(type);
      setSlots([]);
    }
  };

  const pickSlot = async (timeSlot: string) => {
    if (busy) return;
    setBusy(true);
    try {
      // Switching chips: free the old hold first, then grab the new one
      if (hold) await releaseHold(hold.id).catch(() => {});
      const res = await createHold({
        doctorId,
        appointmentDate: dateStr,
        timeSlot,
        durationInMinutes: Number(duration),
        consultationType,
        patientId: selectedPatientId || undefined,
      });
      const data = res.data?.data;
      setHold({
        id: data.hold.id,
        timeSlot: data.hold.timeSlot,
        expiresAt: new Date(data.hold.expiresAt).getTime(),
      });
      toast.success(`Slot ${timeSlot} is held for you — you have a few minutes to finish`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not hold this slot. Please try again."));
    } finally {
      setBusy(false);
      loadSlots();
    }
  };

  const confirmBooking = async (values: DetailsForm) => {
    if (!hold) {
      toast.error("Your slot hold expired — please pick a slot again");
      setStep(1);
      return;
    }
    setBusy(true);
    try {
      const res = await bookFromHold(hold.id, { intakeDetails: values.intakeDetails });
      const appointment = res.data?.data;
      setBookedAppointment(appointment);
      setHold(null);
      setSecondsLeft(0);
      setStep(3);
      getAppointmentTicketQrUrl(appointment._id)
        .then(setQrUrl)
        .catch(() => setQrUrl(""));
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not complete the booking"));
      loadSlots();
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    setBookedAppointment(null);
    setQrUrl("");
    setStep(0);
    setSlots([]);
    setDateStr("");
    setDoctorId("");
    setSelectedPatientId(undefined);
    setHold(null);
    setSecondsLeft(0);
  };

  const selectedDoctor = doctors.find((d) => d._id === doctorId);
  const progressLabels = ["Doctor & Date", "Pick a time", "Your details", "Confirmed"];

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
      <Card className="w-full shadow-md border-neutral-100">
        <CardHeader className="space-y-1">
          <CardTitle className="text-center text-3xl font-bold tracking-tight text-neutral-900">
            Book an Appointment
          </CardTitle>
          <CardDescription className="text-center text-neutral-500">
            Pick a doctor, choose a free time like a movie seat, and confirm — the slot is
            held for you while you fill in your details.
          </CardDescription>
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
            {progressLabels.map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    i === step
                      ? "bg-primary text-primary-foreground"
                      : i < step
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {i + 1}. {label}
                </span>
                {i < progressLabels.length - 1 && <span className="text-neutral-300">→</span>}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ================= STEP 1: DOCTOR & DATE ================= */}
          {step === 0 && (
            <div className="space-y-5">
              <Field className="flex flex-col gap-1.5">
                <FieldLabel className="font-semibold text-neutral-700">Doctor</FieldLabel>
                <Select onValueChange={changeDoctor} value={doctorId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    {doctors.map((doctor) => (
                      <SelectItem key={doctor._id} value={doctor._id}>
                        {doctor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field className="flex flex-col gap-1.5">
                <FieldLabel className="font-semibold text-neutral-700">Appointment Date</FieldLabel>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      type="button"
                      className="w-full justify-start font-normal"
                    >
                      {dateStr ? dateStr : <span className="text-muted-foreground">Select date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateStr ? new Date(`${dateStr}T12:00:00`) : undefined}
                      defaultMonth={dateStr ? new Date(`${dateStr}T12:00:00`) : undefined}
                      captionLayout="dropdown"
                      onSelect={(selectedDate) => {
                        if (selectedDate) {
                          const year = selectedDate.getFullYear();
                          const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
                          const day = String(selectedDate.getDate()).padStart(2, "0");
                          changeDate(`${year}-${month}-${day}`);
                          setDateOpen(false);
                        }
                      }}
                      disabled={(date) =>
                        date < new Date(new Date().setHours(0, 0, 0, 0)) ||
                        date < new Date("1900-01-01")
                      }
                    />
                  </PopoverContent>
                </Popover>
              </Field>

              <Field className="flex flex-col gap-1.5">
                <FieldLabel className="font-semibold text-neutral-700">Consultation Type</FieldLabel>
                <Select onValueChange={changeType} value={consultationType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Initial">Initial (30 minutes)</SelectItem>
                    <SelectItem value="Follow-up">Follow-up (15 minutes)</SelectItem>
                    <SelectItem value="Acute">Acute (15 minutes)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {familyMembers.length > 0 && (
                <Field className="flex flex-col gap-1.5">
                  <FieldLabel className="font-semibold text-neutral-700">
                    Who is this appointment for?
                  </FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={!selectedPatientId ? "default" : "outline"}
                      size="sm"
                      className="rounded-full"
                      onClick={() => setSelectedPatientId(undefined)}
                    >
                      Myself
                    </Button>
                    {familyMembers.map((member) => (
                      <Button
                        key={member._id}
                        type="button"
                        variant={selectedPatientId === member._id ? "default" : "outline"}
                        size="sm"
                        className="rounded-full"
                        onClick={() => setSelectedPatientId(member._id)}
                      >
                        {member.name}
                      </Button>
                    ))}
                  </div>
                </Field>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={!doctorId || !dateStr}
                >
                  See available times →
                </Button>
              </div>
            </div>
          )}

          {/* ================= STEP 2: TIME CHIPS ================= */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-emerald-100 border border-emerald-300" /> Free
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-amber-100 border border-amber-400" /> Held by you
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-neutral-200 border border-neutral-300" /> Held by someone
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-neutral-100 border border-neutral-200" /> Booked / on leave
                </span>
                <span className="ml-auto">Updates automatically every 30 seconds</span>
              </div>

              {hold && secondsLeft > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="relative flex size-3">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex size-3 rounded-full bg-amber-500" />
                    </span>
                    <span className="text-sm font-semibold text-amber-800">
                      {hold.timeSlot} is held for you
                    </span>
                    <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">
                      {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      releaseCurrentHold();
                      loadSlots();
                    }}
                  >
                    Release slot
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">
                  Tap a free time to hold it while you fill in your details.
                </p>
              )}

              {slotsLoading && slots.length === 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="h-9 w-24 animate-pulse rounded-md bg-neutral-100" />
                  ))}
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No available slots for this doctor on {dateStr}. They may be on leave — try
                  another date.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => {
                    const isMine = slot.state === "held-by-me";
                    const disabled = slot.state !== "free" && !isMine;
                    return (
                      <Button
                        key={slot.timeSlot}
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        onClick={() => pickSlot(slot.timeSlot)}
                        className={
                          isMine
                            ? "border-amber-400 bg-amber-100 font-semibold text-amber-800 hover:bg-amber-200"
                            : slot.state === "free"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              : slot.state === "held"
                                ? "border-neutral-200 bg-neutral-100 text-neutral-400"
                                : "border-neutral-100 bg-neutral-50 text-neutral-300"
                        }
                      >
                        {slot.timeSlot}
                        {isMine && " ✓"}
                      </Button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="outline" onClick={() => setStep(0)}>
                  ← Back
                </Button>
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!hold || secondsLeft <= 0 || busy}
                >
                  Continue to details →
                </Button>
              </div>
            </div>
          )}

          {/* ================= STEP 3: VISIT DETAILS ================= */}
          {step === 2 && (
            <form onSubmit={handleSubmit(confirmBooking)} className="space-y-5">
              {hold && secondsLeft > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
                  <span className="relative flex size-3">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-amber-500" />
                  </span>
                  <span className="text-sm text-amber-800">
                    Your slot is held for {Math.floor(secondsLeft / 60)}:
                    {String(secondsLeft % 60).padStart(2, "0")} — take your time.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <Field className="flex flex-col gap-1.5">
                  <FieldLabel className="font-semibold text-neutral-700">
                    Primary Complaint <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Textarea
                    placeholder="What is the main problem you're visiting for?"
                    {...register("intakeDetails.primaryComplaint")}
                  />
                  <FieldError errors={[errors.intakeDetails?.primaryComplaint]} />
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field className="flex flex-col gap-1.5">
                    <FieldLabel className="font-semibold text-neutral-700">
                      Duration of Complaint <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      placeholder="e.g. Since 2 weeks"
                      {...register("intakeDetails.duration")}
                    />
                    <FieldError errors={[errors.intakeDetails?.duration]} />
                  </Field>
                  <Field className="flex flex-col gap-1.5">
                    <FieldLabel className="font-semibold text-neutral-700">
                      Current Medication <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      placeholder="Any medicines you're currently taking"
                      {...register("intakeDetails.currentMedication")}
                    />
                    <FieldError errors={[errors.intakeDetails?.currentMedication]} />
                  </Field>
                </div>

                <Field className="flex flex-col gap-1.5">
                  <FieldLabel className="font-semibold text-neutral-700">
                    Past Medical History <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Textarea
                    placeholder="Any past illnesses, treatments or surgeries"
                    {...register("intakeDetails.pastMedicalHistory")}
                  />
                  <FieldError errors={[errors.intakeDetails?.pastMedicalHistory]} />
                </Field>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={busy}
                >
                  ← Back
                </Button>
                <Button type="submit" disabled={busy || !hold || secondsLeft <= 0}>
                  {busy ? "Booking…" : "Confirm booking ✓"}
                </Button>
              </div>
            </form>
          )}

          {/* ================= STEP 4: CONFIRMED + TICKET ================= */}
          {step === 3 && bookedAppointment && (
            <div className="flex flex-col items-center gap-6 py-2 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
                <svg
                  viewBox="0 0 24 24"
                  className="size-8 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-neutral-900">You're booked! 🎉</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Show this ticket (paper or phone) at the reception desk to check in.
                </p>
              </div>

              <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-neutral-50 p-5">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Doctor</span>
                    <span className="font-semibold text-neutral-900">
                      {selectedDoctor?.name || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Date</span>
                    <span className="font-semibold text-neutral-900">{dateStr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Time</span>
                    <span className="font-semibold text-neutral-900">
                      {bookedAppointment.timeSlot}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Type</span>
                    <span className="font-semibold text-neutral-900">
                      {bookedAppointment.consultationType} · {bookedAppointment.durationInMinutes} min
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex justify-center">
                  {qrUrl ? (
                    <img
                      src={qrUrl}
                      alt="Appointment ticket QR"
                      className="size-40 rounded-lg border border-neutral-200 bg-white p-1"
                    />
                  ) : (
                    <div className="size-40 animate-pulse rounded-lg bg-neutral-200" />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadAppointmentTicket(bookedAppointment._id)}
                >
                  Download ticket (PDF)
                </Button>
                <Button type="button" onClick={() => navigate(`/${user?.role}/appointments`)}>
                  View my appointments
                </Button>
                <Button type="button" variant="ghost" onClick={resetAll}>
                  Book another
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        {step < 3 && (
          <CardFooter className="border-t border-neutral-100 text-xs text-neutral-400">
            Free slots refresh automatically. A held slot is yours for 5 minutes — it's released
            automatically if the timer runs out.
          </CardFooter>
        )}
      </Card>
    </div>
  );
}