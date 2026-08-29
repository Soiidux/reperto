import ConsultationCard from "@/components/ConsultationCard";

import { getPatientHistory } from "@/api/consultation";

import { useEffect, useMemo, useState } from "react";
import { Search, FolderOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

import { useParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

interface Consultation {
  _id: string;

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

export default function ConsultationHistory() {
  const { user } = useAuthStore();
  const { patientId: paramPatientId } = useParams<{
    patientId: string;
  }>();
  let patientId : string = ""
  
  if(user!.role === "patient") {
    patientId = user!.id;
  } else if(user!.role === "doctor") {
    patientId = paramPatientId || "";
  }

  const [count, setCount] =
    useState(0);

  const [consultations, setConsultations] =
    useState<Consultation[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [searchInput, setSearchInput] =
    useState("");

  const search = useMemo(
    () => searchInput.trim().toLowerCase(),
    [searchInput],
  );

  // Client-side filter: history pages are small, so filtering in memory
  // across doctor name, diagnosis, and consultation type is plenty.
  const filtered = useMemo(() => {
    if (!search) return consultations;
    return consultations.filter((consultation) =>
      [
        typeof consultation.doctorId === "object" ? consultation.doctorId?.name : "",
        consultation.diagnosis,
        consultation.appointmentId?.consultationType,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [consultations, search]);

  useEffect(() => {

    if (!patientId) return;

    async function fetchHistory() {

      try {

        setLoading(true);

        const response =
          await getPatientHistory(
            patientId
          );

        setConsultations(
          response.data.data.history
        );

        setCount(
          response.data.data.count
        );

      } catch (error) {

        console.error(error);

      } finally {

        setLoading(false);

      }

    }

    fetchHistory();

  }, [patientId]);

  if (loading) {

    return (

      <div className="p-6">

        Loading...

      </div>

    );

  }

  return (

    <div className="flex flex-col gap-4 p-6">

      <div className="flex flex-wrap justify-between items-center gap-3">

        <span className="text-sm text-gray-500">

          {count} Past Consultations

        </span>

        <div className="flex items-center gap-2">

          <div className="relative w-full max-w-xs">

            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />

            <Input

              placeholder="Search by doctor, diagnosis, or type"

              value={searchInput}

              onChange={(e) => setSearchInput(e.target.value)}

              className="pl-9"

            />

          </div>

          <Button size="sm" variant="outline" asChild>

            <Link
              to={
                user?.role === "doctor"
                  ? `/doctor/reports/${patientId}`
                  : "/patient/reports"
              }
            >
              <FolderOpen className="size-4 mr-1" /> Reports
            </Link>

          </Button>

        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {filtered.length !== 0 ? (

          filtered.map(
            (consultation) => (

              <ConsultationCard

                key={consultation._id}

                {...consultation}

              />

            )
          )

        ) : (

          <p>

            {search ? "No consultations match your search." : "No consultation history found."}

          </p>

        )}

      </div>

    </div>

  );
}