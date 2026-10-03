import { HeartPulse, Leaf, ShieldCheck, Stethoscope } from "lucide-react";
import type { ClinicSettings } from "@/api/clinic";

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
    <section id="about" className="scroll-mt-24 w-full bg-white">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-16 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:gap-16">
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary/70">
              About the clinic
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
              {clinic?.clinicName || "Reperto Homeopathic Clinic"}
            </h2>
            <p className="text-neutral-600 leading-relaxed">
              {clinic?.about?.trim() ||
                "Reperto is a homeopathic clinic where patients book, attend and follow up on their care without paperwork. Every visit is tracked end to end, from the booking request to the follow-up reminder."}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-neutral-100 bg-neutral-50 p-5"
              >
                <div className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon size={20} />
                </div>
                <h3 className="font-semibold text-neutral-900">{title}</h3>
                <p className="mt-1 text-sm text-neutral-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
