import { useEffect } from "react";
import { useDoctorStore } from "@/store/doctorStore";
import { DoctorCard } from "@/components/DoctorCard";
import { Loader2, Users } from "lucide-react";

export default function FindDoctors() {
  const { doctors, isLoading, error, fetchDoctors } = useDoctorStore();

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
              key={doctor.id}
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