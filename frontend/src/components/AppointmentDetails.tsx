import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  FieldSet,
  FieldLegend,
  FieldSeparator,
} from "./ui/field";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { useParams ,Link} from "react-router-dom";
import { getAppointmentById } from "@/api/appointment";
import { Calendar,VenusAndMars, Clock, User, Hourglass, NotepadText, CalendarClockIcon, LucideTimer, Pill, History, CheckCircle, CalendarPlus } from "lucide-react";
import getAge from "@/utils/getAge";
import { useAuthStore } from "@/store/authStore";
import { CancellationButton } from "./CancellationButton";
import { RescheduleDialog } from "./RescheduleDialog";
import { AcceptSuggestionButton } from "./AcceptSuggestionButton";
import { getErrorMessage } from "@/lib/utils";


interface Appointment {
  _id: string;
  patientId: {
    _id: string;
    name: string;
    gender: string;
    dateOfBirth: string;
    profileImageUrl?: string;
  }; // Polished to adapt if patientId is populated or raw ID string
  doctorId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
  }; // Polished to adapt if doctorId is populated or raw ID string
  appointmentDate: string;
  timeSlot: string;
  durationInMinutes: number;
  status: "pending" | "arrived" | "completed" | "cancelled" | "no-show";
  consultationType: 'Initial' | 'Follow-up' | 'Acute';
  needsReschedule?: boolean;
  rescheduleSuggestions?: { date: string; timeSlot: string }[];
  intakeDetails: {
    primaryComplaint: string;
    duration: string;
    currentMedication: string;
    pastMedicalHistory: string;
  }
  cancellationReason: string;
};

export default function AppointmentDetails() {
  const { user } = useAuthStore();
  const [appointmentData, setAppointmentData] = useState<Appointment | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetchAppointment = async () => {
      try {
        const response = await getAppointmentById(id);
        if (!cancelled) setAppointmentData(response.data.data);
      } catch (error) {
        if (!cancelled) setLoadError(getErrorMessage(error, "Failed to load appointment details"));
      }
    };
    fetchAppointment();
    return () => {
      cancelled = true;
    };
  }, [id]);
  const { _id, patientId : patient, doctorId : doctor, appointmentDate, timeSlot, durationInMinutes, status, needsReschedule, rescheduleSuggestions } = appointmentData || {};
  if (!appointmentData) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
        <Card className="w-full shadow-md border-neutral-100">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-3xl font-bold tracking-tight text-neutral-900">
                Appointment Details
              </CardTitle>
              <CardDescription className="text-center text-neutral-500">
                {loadError ?? "Loading..."}
              </CardDescription>
            </CardHeader>
        </Card>
      </div>
    )
  }
  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
      <Card className="w-full shadow-md border-neutral-100">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-3xl font-bold tracking-tight text-neutral-900">
              Appointment Details
            </CardTitle>
          <CardDescription className="text-center text-neutral-500 text-xl font-semibold">
            Appointment Id : {_id}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <FieldSeparator className="my-2 border-neutral-100" />

            {/* Reschedule-required banner: doctor leave conflicted with this booking */}
            {needsReschedule && status === "pending" && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:bg-amber-950/30 dark:border-amber-800">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
                  The doctor is on leave during this appointment — pick a new time:
                </p>
                {rescheduleSuggestions && rescheduleSuggestions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {rescheduleSuggestions.map((suggestion, index) => (
                      <AcceptSuggestionButton key={index} appointmentId={_id!} suggestion={suggestion} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-amber-800 dark:text-amber-400">
                    No suggestions available — use the Reschedule button to choose another slot.
                  </p>
                )}
              </div>
            )}

            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
                Patient Information
            </FieldLegend>
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center justify-center w-56 h-56 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 text-neutral-600 dark:text-neutral-300">
                  <img
                    src={patient?.profileImageUrl}
                    alt="Patient Profile"
                    className="w-full h-full object-cover rounded-lg"
                  />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
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
            </div>
            </FieldSet>
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
                Appointment Details
            </FieldLegend>
            <div className="flex items-center justify-center gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center justify-center w-32 h-32 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 text-neutral-600 dark:text-neutral-300">
                    <img
                      src={doctor!.profileImageUrl}
                      alt="Doctor Profile"
                      className="w-full h-full object-cover rounded-lg"
                    />
                </div>
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <User className="w-5 h-5 text-neutral-400 shrink-0" />
              
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Doctor Name
                    </span>
                    <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                      {doctor!.name}
                    </span>
                  </div>
                </div>
                {/* Date */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <CalendarClockIcon className="w-5 h-5 text-neutral-400 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Date
                    </span>              
                    <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                      {new Date(appointmentDate!).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                  </div>
                </div>
              
                {/* Time */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <Clock className="w-5 h-5 text-neutral-400 shrink-0" />
              
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Time Slot
                    </span>
              
                    <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                      {timeSlot}
                    </span>
                  </div>
                </div>
              
                {/* Duration */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <Hourglass className="w-5 h-5 text-neutral-400 shrink-0" />
              
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Appointment Duration
                    </span>
              
                    <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                      {durationInMinutes} minutes
                    </span>
                  </div>
                </div>
                {/*Status */}
                <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
                  <CheckCircle className="w-5 h-5 text-neutral-400 shrink-0" />
              
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground font-medium">
                      Status
                    </span>
              
                    <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
                      {status ? status.charAt(0).toUpperCase() + status.slice(1) : ""}
                    </span>
                  </div>
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

            
          </CardContent>
          <CardFooter className="flex justify-center items-center gap-2">
          {status === "pending" && user!.role === "patient" && <CancellationButton appointmentId={_id!} />}
          {status === "pending" && (
            <RescheduleDialog
              appointmentId={_id!}
              doctorId={typeof doctor === "object" ? doctor._id : (doctor as unknown as string)}
              durationInMinutes={durationInMinutes!}
              currentDate={appointmentDate!}
              currentTimeSlot={timeSlot!}
            />
          )}
          {status === "arrived" && user!.role === "doctor" && (
            <Button variant="default" size="lg" asChild className="px-4 font-medium">
              <Link to={`/doctor/start-consultation/${_id}`}>Start Consultation</Link>
            </Button>
          )}
          {status === "completed" && (
            <>
              {(user?.role === "patient" || user?.role === "staff" || user?.role === "admin") && (
                <Button variant="outline">
                  <Link to={`/${user!.role}/book-appointment?type=Follow-up&doctorId=${typeof doctor === "object" ? doctor._id : ""}${user?.role !== "patient" && typeof patient === "object" ? `&patientId=${patient._id}&patientName=${encodeURIComponent(patient.name)}` : ""}`}>
                    <CalendarPlus /> Book Follow-up
                  </Link>
                </Button>
              )}
              <Button variant="default"><Link to={`/${user!.role}/consultation/${_id}`}>View Consultation</Link></Button>
            </>
          )}
          </CardFooter>
      </Card>
    </div>
  );
}