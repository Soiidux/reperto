import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

import {
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "./ui/field";

import { useEffect, useState, useCallback } from "react";

import { useParams } from "react-router-dom";

import {
  Calendar,
  CalendarClockIcon,
  Clock,
  Hourglass,
  User,
  VenusAndMars,
  CheckCircle,
  NotepadText,
  LucideTimer,
  Pill,
  History,
  MapPin,
  Activity,
  ArrowUp,
  ArrowDown,
  Thermometer,
  GlassWater,
  Utensils,
  Bed,
  Brain,
  Stethoscope,
  FileText,
  FolderOpen,
} from "lucide-react";

import { getAppointmentById } from "@/api/appointment";
import { getConsultation } from "@/api/consultation";
import { useAuthStore } from "@/store/authStore";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "./ui/button";
import { DoctorReviews } from "./DoctorReviews";
import { Link } from "react-router-dom";

import getAge from "@/utils/getAge";

interface Appointment {
  _id: string;

  patientId: {
    _id: string;
    name: string;
    gender: string;
    dateOfBirth: string;
    profileImageUrl?: string;
  };

  doctorId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
  };

  appointmentDate: string;

  timeSlot: string;

  durationInMinutes: number;

  status:
    | "pending"
    | "arrived"
    | "completed"
    | "cancelled"
    | "no-show";

  consultationType: "Initial" | "Follow-up" | "Acute";

  intakeDetails: {
    primaryComplaint: string;
    duration: string;
    currentMedication: string;
    pastMedicalHistory: string;
  };

  cancellationReason: string;
}

interface Consultation {
  _id: string;

  appointmentId: string;

  patientId: string;

  doctorId: {
    _id: string;
    name: string;
    profileImageUrl?: string;
  };

  chiefComplaintDetails: {
    location: string;

    sensation: string;

    modalities: {
      Aggravation: string;

      Amlioration: string;
    };

    concomitants: string;
  };

  pastMedicalHistory: string;

  physicalGenerals: {
    thermals: string;

    thirst: string;

    appetiteAndCravings: string;

    sleepAndDreams: string;
  };

  mentalGenerals: string;

  diagnosis: string;

  prescriptions: {
    remedyName: string;

    potency: string | null;

    dosage: string;

    durationInDays: number;
  }[];

  doctorNotes: string;

  followUpDate?: string | null;
  followUpStatus?: "pending" | "overdue" | "done" | "skipped";
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;

  label: string;

  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border p-5 min-h-24">
      <div className="text-neutral-400 shrink-0">{icon}</div>

      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground font-medium">
          {label}
        </span>

        <span className="text-lg font-semibold text-neutral-700 dark:text-neutral-300">
          {value}
        </span>
      </div>
    </div>
  );
}

export default function ConsultationDetails() {
  const { id } = useParams<{
    id: string;
  }>();

  const [appointmentData, setAppointmentData] =
    useState<Appointment>();

  const [consultationData, setConsultationData] =
    useState<Consultation>();

  const [loadError, setLoadError] = useState<string | null>(null);

const { user } = useAuthStore();


  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const fetchData = async () => {
      try {
        const appointmentResponse =
          await getAppointmentById(id);

        const appointment =
          appointmentResponse.data.data;

        if (cancelled) return;
        setAppointmentData(appointment);

        const consultationResponse =
          await getConsultation(
            appointment.patientId._id,
            id
          );

        if (cancelled) return;
        setConsultationData(
          consultationResponse.data.data
        );
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setLoadError(
            "This consultation couldn't be loaded. It may have been removed, or this link may be out of date.",
          );
        }
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Re-read the consultation after a child action changes it (e.g. saving a
  // review no longer does, but rescheduling/accepting a suggestion does).
  const onRefresh = useCallback(async () => {
    if (!id) return;
    try {
      const appointmentResponse = await getAppointmentById(id);
      setAppointmentData(appointmentResponse.data.data);
    } catch (error) {
      setLoadError(getErrorMessage(error, "Failed to load appointment details"));
    }
  }, [id]);

  if (loadError) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-3xl">
              Consultation Details
            </CardTitle>

            <CardDescription className="text-center">
              {loadError}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button asChild variant="outline">
              <Link to="/">Go to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!appointmentData || !consultationData) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-3xl">
              Consultation Details
            </CardTitle>

            <CardDescription className="text-center">
              Loading...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const {
    _id,
    patientId: patient,
    doctorId: doctor,
    appointmentDate,
    timeSlot,
    durationInMinutes,
    status,
    consultationType,
    intakeDetails,
  } = appointmentData;

  const {
    chiefComplaintDetails,
    physicalGenerals,
    mentalGenerals,
    diagnosis,
    prescriptions,
    doctorNotes,
    pastMedicalHistory,
  } = consultationData;

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6">
      <Card className="shadow-md border-neutral-100">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold">
            Consultation Details
          </CardTitle>

          <CardDescription className="text-center text-xl font-semibold">
            Appointment Id : {_id}
          </CardDescription>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {user?.role === "doctor" && (
              <Button variant="outline" size="sm">
                <Link to={`/doctor/reports/${patient._id}`}>
                  <FolderOpen className="mr-2 size-4" /> View Reports
                </Link>
              </Button>
            )}
            {user?.role === "patient" && (
              <Button size="sm">
                <Link to={`/patient/book-appointment?doctorId=${doctor._id}&type=Follow-up`}>
                  Book Follow-up
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Follow-up banner: visible to patients when their course has ended */}
          {user?.role === "patient" && consultationData?.followUpStatus && ["pending", "overdue"].includes(consultationData.followUpStatus) && (
            <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${consultationData.followUpStatus === "overdue" ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
              <span>
                {consultationData.followUpStatus === "overdue"
                  ? "Your treatment course ended — please book a follow-up consultation."
                  : "Your treatment course is nearing its end. Consider booking a follow-up."}
              </span>
              <Button size="sm" asChild className={`${consultationData.followUpStatus === "overdue" ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"} text-white`}>
                <Link to={`/patient/book-appointment?doctorId=${doctor._id}&type=Follow-up`}>
                  Book Follow-up
                </Link>
              </Button>
            </div>
          )}
          <FieldSeparator />

          {/* Patient Information */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Patient Information
            </FieldLegend>

            <div className="flex items-center gap-4">
              <div className="w-56 h-56 rounded-lg overflow-hidden border">
                <img
                  src={patient.profileImageUrl}
                  alt="Patient"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="grid md:grid-cols-3 gap-6 w-full">
                <InfoCard
                  icon={<User size={20} />}
                  label="Name"
                  value={patient.name}
                />

                <InfoCard
                  icon={<Calendar size={20} />}
                  label="Age"
                  value={getAge(patient.dateOfBirth)}
                />

                <InfoCard
                  icon={<VenusAndMars size={20} />}
                  label="Gender"
                  value={
                    patient.gender
                      ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
                      : "\u2014"
                  }
                />
              </div>
            </div>
          </FieldSet>

          {/* Appointment Information */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Appointment Details
            </FieldLegend>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="w-32 h-32 rounded-lg overflow-hidden border">
                <img
                  src={doctor.profileImageUrl}
                  alt="Doctor"
                  className="w-full h-full object-cover"
                />
              </div>

              <InfoCard
                icon={<User size={20} />}
                label="Doctor Name"
                value={doctor.name}
              />

              <InfoCard
                icon={<CalendarClockIcon size={20} />}
                label="Date"
                value={new Date(
                  appointmentDate
                ).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              />

              <InfoCard
                icon={<Clock size={20} />}
                label="Time Slot"
                value={timeSlot}
              />

              <InfoCard
                icon={<Hourglass size={20} />}
                label="Duration"
                value={`${durationInMinutes} minutes`}
              />

              <InfoCard
                icon={<CheckCircle size={20} />}
                label="Status"
                value={
                  status.charAt(0).toUpperCase() +
                  status.slice(1)
                }
              />

              <InfoCard
                icon={<Stethoscope size={20} />}
                label="Consultation Type"
                value={consultationType}
              />
            </div>
          </FieldSet>

          {/* Intake Details */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Intake Details
            </FieldLegend>

            <div className="grid gap-4">
              <InfoCard
                icon={<NotepadText size={20} />}
                label="Primary Complaint"
                value={intakeDetails.primaryComplaint}
              />

              <InfoCard
                icon={<LucideTimer size={20} />}
                label="Duration"
                value={intakeDetails.duration}
              />

              <InfoCard
                icon={<Pill size={20} />}
                label="Current Medication"
                value={intakeDetails.currentMedication}
              />

              <InfoCard
                icon={<History size={20} />}
                label="Past Medical History"
                value={intakeDetails.pastMedicalHistory}
              />
            </div>
          </FieldSet>

          {/* Chief Complaint */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Chief Complaint Details
            </FieldLegend>

            <div className="grid gap-4">
              <InfoCard
                icon={<MapPin size={20} />}
                label="Location"
                value={chiefComplaintDetails.location}
              />

              <InfoCard
                icon={<Activity size={20} />}
                label="Sensation"
                value={chiefComplaintDetails.sensation}
              />

              <InfoCard
                icon={<ArrowUp size={20} />}
                label="Aggravation"
                value={
                  chiefComplaintDetails.modalities
                    .Aggravation
                }
              />

              <InfoCard
                icon={<ArrowDown size={20} />}
                label="Amelioration"
                value={
                  chiefComplaintDetails.modalities
                    .Amlioration
                }
              />

              <InfoCard
                icon={<Activity size={20} />}
                label="Concomitants"
                value={chiefComplaintDetails.concomitants}
              />
            </div>
          </FieldSet>

          {/* Consultation PMH */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Consultation Past Medical History
            </FieldLegend>

            <InfoCard
              icon={<History size={20} />}
              label="Past Medical History"
              value={pastMedicalHistory}
            />
          </FieldSet>

          {/* Physical Generals */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Physical Generals
            </FieldLegend>

            <div className="grid gap-4">
              <InfoCard
                icon={<Thermometer size={20} />}
                label="Thermals"
                value={physicalGenerals.thermals}
              />

              <InfoCard
                icon={<GlassWater size={20} />}
                label="Thirst"
                value={physicalGenerals.thirst}
              />

              <InfoCard
                icon={<Utensils size={20} />}
                label="Appetite & Cravings"
                value={
                  physicalGenerals.appetiteAndCravings
                }
              />

              <InfoCard
                icon={<Bed size={20} />}
                label="Sleep & Dreams"
                value={physicalGenerals.sleepAndDreams}
              />
            </div>
          </FieldSet>

          {/* Mental Generals */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Mental Generals
            </FieldLegend>

            <InfoCard
              icon={<Brain size={20} />}
              label="Mental Generals"
              value={mentalGenerals}
            />
          </FieldSet>

          {/* Diagnosis */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Diagnosis
            </FieldLegend>

            <InfoCard
              icon={<Stethoscope size={20} />}
              label="Diagnosis"
              value={diagnosis}
            />
          </FieldSet>

          {/* Prescriptions */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Prescriptions
            </FieldLegend>

            <div className="space-y-4">
              {prescriptions.map((item, index) => (
                <div
                  key={index}
                  className="border rounded-lg p-5 space-y-4"
                >
                  <h3 className="font-semibold text-lg">
                    Prescription {index + 1}
                  </h3>

                  <InfoCard
                    icon={<Pill size={20} />}
                    label="Remedy Name"
                    value={item.remedyName}
                  />

                  <InfoCard
                    icon={<Pill size={20} />}
                    label="Potency"
                    value={item.potency ?? "-"}
                  />

                  <InfoCard
                    icon={<Pill size={20} />}
                    label="Dosage"
                    value={item.dosage}
                  />

                  <InfoCard
                    icon={<Calendar size={20} />}
                    label="Duration"
                    value={`${item.durationInDays} days`}
                  />
                </div>
              ))}
            </div>
          </FieldSet>

          {/* Doctor Notes */}

          <FieldSet className="space-y-4">
            <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
              Doctor Notes
            </FieldLegend>

            <InfoCard
              icon={<FileText size={20} />}
              label="Doctor Notes"
              value={doctorNotes}
            />
          </FieldSet>

          {/* Replaced by the shared DoctorReviews component, which owns the
              eligibility messaging and summary that this block lacked. */}
          {typeof doctor === "object" && (
            <FieldSet className="space-y-4">
              <FieldLegend className="text-lg font-bold border-b pb-2 w-full">
                Doctor Reviews
              </FieldLegend>
              <DoctorReviews
                doctorId={doctor._id}
                doctorName={doctor.name}
                onChanged={onRefresh}
              />
            </FieldSet>
          )}
        </CardContent>
      </Card>
    </div>
  );
}