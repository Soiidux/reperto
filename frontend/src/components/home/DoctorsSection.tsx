import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Loader2, Users } from "lucide-react";
import { useDoctorStore } from "@/store/doctorStore";
import { DoctorCard } from "@/components/DoctorCard";

export function DoctorsSection() {
  const { doctors, isLoading, error, fetchDoctors } = useDoctorStore();

  // main.tsx primes the store on boot; this keeps the section correct on a
  // cold deep-link straight into /#doctors.
  useEffect(() => {
    if (doctors.length === 0) fetchDoctors();
  }, [doctors.length, fetchDoctors]);

  return (
    <section id="doctors" className="scroll-mt-24 w-full bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-16 md:py-20">
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary/70">
            Our doctors
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            Find the right practitioner
          </h2>
          <p className="text-neutral-500">
            Browse qualifications, experience and patient ratings, then book the
            slot that suits you.
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-20 gap-3 text-neutral-400">
            <Loader2 className="animate-spin text-primary h-8 w-8" />
            <p className="text-sm font-medium">Loading practitioner profiles...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 border border-red-100 rounded-2xl bg-red-50/50 text-red-600 max-w-xl mx-auto p-6">
            <p className="font-semibold">Failed to load practitioner profiles</p>
            <p className="text-sm text-red-500 mt-1">{error}</p>
          </div>
        ) : doctors.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map((doctor) => (
              <DoctorCard key={doctor._id} doctor={doctor} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-neutral-200 rounded-2xl bg-white flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-neutral-50 border flex items-center justify-center text-neutral-400">
              <Users size={20} />
            </div>
            <p className="text-neutral-400 font-medium">
              No practitioners are listed yet — check back soon.
            </p>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            to="/doctors"
            className="inline-flex items-center gap-2 text-primary bg-primary/10 hover:bg-primary/20 px-5 py-2.5 rounded-xl font-semibold transition-all"
          >
            View the full directory
          </Link>
        </div>
      </div>
    </section>
  );
}
