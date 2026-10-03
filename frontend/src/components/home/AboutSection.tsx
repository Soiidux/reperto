import { HeartPulse, Leaf, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import type { ClinicSettings } from "@/api/clinic";
import { Reveal } from "@/components/home/Reveal";
import { WaveDivider } from "@/components/home/WaveDivider";

type AboutSectionProps = {
  clinic: ClinicSettings | null;
};

const HIGHLIGHTS = [
  {
    icon: Stethoscope,
    title: "Qualified practitioners",
    body: "Verified doctors with transparent qualifications, experience and patient reviews.",
  },
  {
    icon: HeartPulse,
    title: "Whole-person care",
    body: "Consultations that follow your treatment through to completion and follow-up.",
  },
  {
    icon: ShieldCheck,
    title: "Your records, private",
    body: "Reports, prescriptions and timelines stay in one secure patient workspace.",
  },
  {
    icon: Leaf,
    title: "Natural remedies",
    body: "Evidence-aware homeopathy planned around your own history and response.",
  },
];

export function AboutSection({ clinic }: AboutSectionProps) {
  return (
    <>
      <section id="about" className="scroll-mt-24 relative overflow-hidden bg-card">
        {/* Soft tint so the section separates from the hero */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full opacity-25 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--secondary) 70%, transparent), transparent 70%)",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-4 md:px-6 py-16 md:py-24">
          <div className="grid gap-12 md:grid-cols-[1.05fr_1fr] md:gap-16">
            <Reveal className="space-y-5">
              <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
                <Sparkles size={14} />
                About the clinic
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                {clinic?.clinicName || "Reperto Homeopathic Clinic"}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {clinic?.about?.trim() ||
                  "Reperto is a homeopathic clinic where patients book, attend and follow up on their care without paperwork. Every visit is tracked end to end, from the booking request to the follow-up reminder."}
              </p>
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-2">
              {HIGHLIGHTS.map(({ icon: Icon, title, body }, index) => (
                <Reveal key={title} delay={index * 90}>
                  <div className="h-full rounded-2xl border border-border bg-background/70 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                    <div className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon size={20} />
                    </div>
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <WaveDivider fillClass="text-background" />
    </>
  );
}
