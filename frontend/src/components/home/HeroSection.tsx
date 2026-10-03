import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck, HeartPulse, Leaf, Sparkles, Stethoscope } from "lucide-react";
import type { ClinicSettings } from "@/api/clinic";
import { ClinicStatusBadge } from "@/components/ClinicStatusBadge";
import { formatSlotLabel } from "@/lib/utils";
import { ClinicIllustration } from "@/components/home/HeroArt";
import { WaveDivider } from "@/components/home/WaveDivider";

/** Small floating chips that decorate the hero around the illustration. */
const HERO_CHIPS = [
  { icon: Stethoscope, label: "Qualified practitioners" },
  { icon: Leaf, label: "Natural remedies" },
  { icon: HeartPulse, label: "Follow-up care" },
];

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
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 md:px-6 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid items-center gap-12 md:grid-cols-[1.05fr_0.95fr]">
            {/* Copy column */}
            <div className="flex flex-col items-start gap-6">
              <div className="flex flex-wrap items-center gap-3">
                <ClinicStatusBadge clinic={clinic} />
                {scheduleSummary && (
                  <span className="text-sm text-muted-foreground">
                    Today's hours {scheduleSummary}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl lg:text-[3.4rem] font-bold leading-[1.08] tracking-tight text-foreground">
                  {clinic?.clinicName || "Reperto Homeopathic Clinic"}
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
                  Consult our practitioners, book a slot in seconds, and manage
                  your whole treatment journey — from first appointment to
                  follow-up care.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  to={isLoggedIn ? "/patient/book-appointment" : "/register"}
                  className="group inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold transition-all hover:opacity-90 hover:shadow-lg hover:shadow-primary/20"
                >
                  <span>Book an appointment</span>
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </Link>
                <a
                  href="#doctors"
                  className="inline-flex items-center gap-2 text-primary bg-primary/10 hover:bg-primary/20 px-6 py-3 rounded-xl font-semibold transition-all"
                >
                  <Sparkles size={18} />
                  <span>Meet our doctors</span>
                </a>
              </div>

              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarCheck size={16} className="text-primary" />
                Online booking, e-ticket check-in and digital reports.
              </p>
            </div>

            {/* Illustration column */}
            <div className="relative mx-auto w-full max-w-md">
              <div
                className="rp-drift-slow absolute inset-0 rounded-[2.5rem] bg-primary/5 blur-2xl"
                aria-hidden
              />
              <ClinicIllustration className="relative w-full h-auto rp-pulse-soft" />

              {/* Floating reassurance chips */}
              <div className="absolute inset-x-0 -bottom-2 flex flex-col gap-2 sm:flex-row sm:justify-center">
                {HERO_CHIPS.map(({ icon: Icon, label }, index) => (
                  <div
                    key={label}
                    className={`inline-flex items-center gap-2 rounded-full border border-border bg-card/90 px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm backdrop-blur ${
                      index % 2 === 0 ? "rp-float" : "rp-float-delayed"
                    }`}
                  >
                    <Icon size={14} className="text-primary" />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <WaveDivider fillClass="text-card" />
    </>
  );
}
