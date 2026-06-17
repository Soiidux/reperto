import {
  Calendar as CalendarIcon,
  FileText,
  Pill,
  Stethoscope,
  MapPin,
} from "lucide-react";

import { Card, CardContent, CardFooter } from "@/components/ui/card";

import { Button } from "./ui/button";

import { Link } from "react-router-dom";

import { useAuthStore } from "@/store/authStore";

interface ConsultationCardProps {
  appointmentId: {
    _id: string;

    appointmentDate: string;

    consultationType:
      | "Initial"
      | "Follow-up"
      | "Acute";
  };

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

  chiefComplaintDetails: {
    location: string;

    sensation: string;
  };

  diagnosis: string;

  prescriptions: {
    remedyName: string;

    potency: string | null;

    dosage: string;

    durationInDays: number;
  }[];
}

export default function ConsultationCard({
  appointmentId,

  patientId,

  doctorId,

  diagnosis,

  prescriptions,
}: ConsultationCardProps) {

  const { user } = useAuthStore();

  const isDoctor =
    user?.role === "doctor";

  const person = isDoctor
    ? patientId
    : doctorId;

  const heading = isDoctor
    ? "Patient"
    : "Attending Physician";

  const formattedDate = new Date(
    appointmentId.appointmentDate
  ).toLocaleDateString("en-IN", {
    day: "numeric",

    month: "short",

    year: "numeric",

    timeZone: "UTC",
  });

  return (

    <Card className="w-full max-w-md border border-neutral-200/70 bg-white dark:bg-neutral-900/50 shadow-xs hover:shadow-md transition-all duration-200 rounded-xl overflow-hidden group">

      <CardContent className="p-4 space-y-3.5">

        {/* Header */}

        <div className="flex items-center gap-6">

          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/50">

            {person.profileImageUrl ? (

              <img
                src={person.profileImageUrl}

                alt={heading}

                className="w-full h-full object-cover rounded-lg"
              />

            ) : (

              <div className="w-full h-full flex items-center justify-center text-sm font-semibold">

                {person.name.charAt(0)}

              </div>

            )}

          </div>

          <div className="flex flex-col">

            <span className="text-xs text-muted-foreground font-medium">

              {heading}

            </span>

            <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200 truncate">

              {person.name}

            </span>

          </div>

        </div>

        <div className="h-[1px] bg-neutral-100 dark:bg-neutral-800/60 w-full" />

        {/* Details */}

        <div className="grid grid-cols-2 gap-y-3 gap-x-2">

          {/* Date */}

          <div className="flex items-start gap-2">

            <CalendarIcon className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />

            <div className="flex flex-col">

              <span className="text-[11px] text-muted-foreground font-medium">

                Date

              </span>

              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">

                {formattedDate}

              </span>

            </div>

          </div>

          {/* Session Type */}

          <div className="flex items-start gap-2">

            <FileText className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />

            <div className="flex flex-col">

              <span className="text-[11px] text-muted-foreground font-medium">

                Session Type

              </span>

              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">

                {appointmentId.consultationType}

              </span>

            </div>

          </div>

          {/* Diagnosis */}

          <div className="flex items-start gap-2">

            <Stethoscope className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />

            <div className="flex flex-col">

              <span className="text-[11px] text-muted-foreground font-medium">

                Diagnosis

              </span>

              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 line-clamp-2">

                {diagnosis}

              </span>

            </div>

          </div>

          {/* Prescription Count */}

          <div className="flex items-start gap-2">

            <Pill className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />

            <div className="flex flex-col">

              <span className="text-[11px] text-muted-foreground font-medium">

                Prescriptions

              </span>

              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">

                {prescriptions.length}

              </span>

            </div>

          </div>

        </div>

      </CardContent>

      <CardFooter className="flex justify-end">

        <Button variant="default">

          <Link
            to={`/${user?.role}/consultation/${appointmentId._id}`}
          >

            View Consultation

          </Link>

        </Button>

      </CardFooter>

    </Card>
  );
}