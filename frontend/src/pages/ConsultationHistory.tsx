import ConsultationCard from "@/components/ConsultationCard";

import { getPatientHistory } from "@/api/consultation";

import { useEffect, useState } from "react";

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
  
  if(user.role === "patient") {
    patientId = user.id;
  } else if(user.role === "doctor") {
    patientId = paramPatientId;
  }

  const [count, setCount] =
    useState(0);

  const [consultations, setConsultations] =
    useState<Consultation[]>([]);

  const [loading, setLoading] =
    useState(true);

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

      <div className="flex justify-between items-center">

        <span className="text-sm text-gray-500">

          {count} Past Consultations

        </span>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

        {count !== 0 ? (

          consultations.map(
            (consultation) => (

              <ConsultationCard

                key={consultation._id}

                {...consultation}

              />

            )
          )

        ) : (

          <p>

            No consultation history found.

          </p>

        )}

      </div>

    </div>

  );
}