import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2, Users } from "lucide-react";
import { useDoctorStore } from "@/store/doctorStore";
import { DoctorCard } from "@/components/DoctorCard";
import { Reveal } from "@/components/home/Reveal";
import { WaveDivider } from "@/components/home/WaveDivider";

export function DoctorsSection() {
  const { doctors, isLoading, error, fetchDoctors } = useDoctorStore();

  // main.tsx primes the store on boot; this keeps the section correct on a
  // cold deep-link straight into /#doctors.
  useEffect(() => {
    if (doctors.length === 0) fetchDoctors();
  }, [doctors.length, fetchDoctors]);

  return (
    <>
      <section
        id="doctors"
        className="scroll-mt-24 relative overflow-hidden bg-background"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 top-24 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--primary) 70%, transparent), transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 md:px-6 py-16 md:py-24">
          <Reveal className="mb-10 flex flex-col items-center gap-3 text-center">
            <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
              <Users size={14} />
              Our doctors
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              Find the right practitioner
            </h2>
            <p className="text-muted-foreground max-w-xl">
              Browse qualifications, experience and patient ratings, then book
              the slot that suits you.
            </p>
          </Reveal>

          {isLoading ? (
            <div className="flex flex-col justify-center items-center py-20 gap-3 text-muted-foreground">
              <Loader2 className="animate-spin text-primary h-8 w-8" />
              <p className="text-sm font-medium">Loading practitioner profiles...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 border border-destructive/20 rounded-2xl bg-destructive/5 text-destructive max-w-xl mx-auto p-6">
              <p className="font-semibold">Failed to load practitioner profiles</p>
              <p className="text-sm mt-1 opacity-80">{error}</p>
            </div>
          ) : doctors.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {doctors.map((doctor, index) => (
                <Reveal key={doctor._id} delay={(index % 3) * 90}>
                  <div className="h-full transition-transform duration-300 hover:-translate-y-1.5">
                    <DoctorCard doctor={doctor} />
                  </div>
                </Reveal>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-border rounded-2xl bg-card/60 flex flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                <Users size={20} />
              </div>
              <p className="text-muted-foreground font-medium">
                No practitioners are listed yet — check back soon.
              </p>
            </div>
          )}

          {doctors.length > 0 && (
            <Reveal className="mt-10 text-center">
              <Link
                to="/doctors"
                className="group inline-flex items-center gap-2 text-primary bg-primary/10 hover:bg-primary/20 px-5 py-2.5 rounded-xl font-semibold transition-all"
              >
                View the full directory
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>
            </Reveal>
          )}
        </div>
      </section>

      <WaveDivider fillClass="text-card" />
    </>
  );
}
