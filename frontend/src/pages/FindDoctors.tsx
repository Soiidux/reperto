import { useEffect } from "react";
import { useDoctorStore } from "@/store/doctorStore";
import { DoctorCard } from "@/components/DoctorCard";
import { ClinicStatusBadge } from "@/components/ClinicStatusBadge";
import { useClinicSettings } from "@/hooks/use-clinic-settings";
import { Loader2, Users, MapPin, Phone } from "lucide-react";

export default function FindDoctors() {
  const { doctors, isLoading, error, fetchDoctors } = useDoctorStore();
  // Public clinic card (name, address, live open/closed) — no auth needed
  const { clinic } = useClinicSettings();

  // Hydrate the doctor directory universally on component load
  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto p-4 md:p-6">
      
      {/* 📋 Header Block */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Our Medical Directory
        </h1>
        <p className="text-neutral-500">
          Browse available expert practitioners at Reperto Clinic to guide your personalized holistic treatment plan.
        </p>
      </div>

      {/* 🏥 Clinic info card */}
      {clinic && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-neutral-900">{clinic.clinicName}</h2>
              {clinic.about && (
                <p className="max-w-2xl text-sm text-neutral-500">{clinic.about}</p>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-neutral-600">
                {clinic.address && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 text-primary" />
                    {clinic.address}
                  </span>
                )}
                {clinic.phone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-4 text-primary" />
                    {clinic.phone}
                  </span>
                )}
              </div>
            </div>
            <ClinicStatusBadge clinic={clinic} />
          </div>
        </div>
      )}

      {/* ⏳ Async Rendering State Triggers */}
      {isLoading ? (
        <div className="flex flex-col justify-center items-center py-24 gap-3 text-neutral-400">
          <Loader2 className="animate-spin text-primary h-8 w-8" />
          <p className="text-sm font-medium">Hydrating practitioner profiles...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12 border border-red-100 rounded-2xl bg-red-50/50 text-red-600 max-w-xl mx-auto p-6">
          <p className="font-semibold">Failed to load system profiles</p>
          <p className="text-sm text-red-500 mt-1">{error}</p>
        </div>
      ) : doctors.length > 0 ? (
        
        /* 🗂️ GRID RENDER CHAIN */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doctor) => (
            <DoctorCard
              key={doctor._id}
              doctor={doctor}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border border-dashed border-neutral-200 rounded-2xl bg-white flex flex-col items-center justify-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-neutral-50 border flex items-center justify-center text-neutral-400">
            <Users size={20} />
          </div>
          <p className="text-neutral-400 font-medium">No practitioners currently listed in the system directory.</p>
        </div>
      )}
    </div>
  );
}
