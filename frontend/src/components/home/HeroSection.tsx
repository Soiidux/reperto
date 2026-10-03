import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, Sparkles } from "lucide-react";
import type { ClinicSettings } from "@/api/clinic";
import { ClinicStatusBadge } from "@/components/ClinicStatusBadge";
import { formatSlotLabel } from "@/lib/utils";

type HeroSectionProps = {
  clinic: ClinicSettings | null;
  isLoggedIn: boolean;
};

export function HeroSection({ clinic, isLoggedIn }: HeroSectionProps) {
  const slots = clinic?.today?.slots ?? [];
  const scheduleSummary =
    clinic?.today?.isOpen && slots.length > 0
      ? `${formatSlotLabel(slots[0])} – ${formatSlotLabel(
          clinic.today.closesAt ?? slots[slots.length - 1],
        )}`
      : null;

  return (
    <section className="w-full bg-gradient-to-b from-primary/5 via-neutral-50 to-neutral-50">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-16 md:py-24">
        <div className="flex flex-col items-start gap-6 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <ClinicStatusBadge clinic={clinic} />
            {scheduleSummary && (
              <span className="text-sm text-neutral-500">
                Today's hours {scheduleSummary}
              </span>
            )}
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-neutral-900">
              {clinic?.clinicName || "Reperto Homeopathic Clinic"}
            </h1>
            <p className="text-lg text-neutral-600 leading-relaxed">
              Consult our practitioners, book a slot in seconds, and manage
              your whole treatment journey — from first appointment to follow-up
              care.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              to={isLoggedIn ? "/patient/book-appointment" : "/register"}
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-semibold transition-all hover:opacity-90 shadow-sm"
            >
              <span>Book an appointment</span>
              <ArrowRight size={18} />
            </Link>
            <a
              href="#doctors"
              className="inline-flex items-center gap-2 text-primary bg-primary/10 hover:bg-primary/20 px-6 py-3 rounded-xl font-semibold transition-all"
            >
              <Sparkles size={18} />
              <span>Meet our doctors</span>
            </a>
          </div>

          <p className="inline-flex items-center gap-2 text-sm text-neutral-500">
            <CalendarCheck size={16} className="text-primary" />
            Online booking, e-ticket check-in and digital reports.
          </p>
        </div>
      </div>
    </section>
  );
}
