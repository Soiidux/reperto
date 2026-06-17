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
import { useNavigate, useParams ,Link} from "react-router-dom";
import { getAppointmentById } from "@/api/appointment";
import { Calendar,VenusAndMars, Clock, User, Hourglass, Hand, AlertCircle, NotepadText, CalendarClockIcon, LucideTimer, Pill, History, CheckCircle } from "lucide-react";
import getAge from "@/utils/getAge";
import { useAuthStore } from "@/store/authStore";


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
  intakeDetails: {
    primaryComplaint: string;
    duration: string;
    currentMedication: string;
    pastMedicalHistory: string;
  }
  cancellationReason: string;
};

export default function AppointmentDetails() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [appointmentData, setAppointmentData] = useState<Appointment | undefined>(undefined);
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    try {
      const fetchAppointment = async () => {
        const response = await getAppointmentById(id);
        setAppointmentData(response.data.data);
        return;
      };
      fetchAppointment();
    } catch (error) {
      console.error(error);
    }
    }, [id]);
  const { _id, patientId : patient, doctorId : doctor, appointmentDate, timeSlot, durationInMinutes, status, consultationType, intakeDetails, cancellationReason } = appointmentData || {};
  if (!appointmentData) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
        <Card className="w-full shadow-md border-neutral-100">
          <CardHeader className="space-y-1">
            <CardTitle className="text-center text-3xl font-bold tracking-tight text-neutral-900">
                Appointment Details
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
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold text-primary border-b border-neutral-100 pb-1 w-full">
                Patient Information
            </FieldLegend>
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center justify-center w-56 h-56 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50 text-neutral-600 dark:text-neutral-300">
                  <img
                    src={patient.profileImageUrl}
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
                      src={doctor.profileImageUrl}
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
                      {doctor.name}
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
                      {new Date(appointmentDate).toLocaleDateString("en-IN", {
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
                      {status.charAt(0).toUpperCase() + status.slice(1)}
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
          <CardFooter className="flex justify-center items-center">
          {status === "pending" && user.role === "patient" && <Button variant="destructive" className="font-medium text-lg">Cancel Appointment</Button>}
          {status === "arrived" && user.role === "doctor" && <Button variant="default" className="font-medium text-lg"><Link to={`/doctor/start-consultation/${_id}`}>Start Consultation</Link></Button>}
          {status === "completed" && (
            <Button variant="default"><Link to={`/${user.role}/consultation/${_id}`}>View Consultation</Link></Button>
          )}
          </CardFooter>
      </Card>
    </div>
  );
}