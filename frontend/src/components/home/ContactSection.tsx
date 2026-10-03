import { Mail, MapPin, Phone } from "lucide-react";
import type { ClinicSettings } from "@/api/clinic";
import { ClinicStatusBadge } from "@/components/ClinicStatusBadge";
import { formatSlotLabel } from "@/lib/utils";
import { Reveal } from "@/components/home/Reveal";

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type ContactSectionProps = {
  clinic: ClinicSettings | null;
};

export function ContactSection({ clinic }: ContactSectionProps) {
  // Sunday-first to match the backend's 0..6 day indexes.
  const hours = [...(clinic?.hours ?? [])].sort((a, b) => a.day - b.day);
  const todayDay = clinic?.today?.day;
  const openToday = clinic?.today?.isOpen && (clinic?.today?.slots.length ?? 0) > 0;

  const details = [
    clinic?.address
      ? {
          icon: MapPin,
          label: "Address",
          value: clinic.address,
          href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
            clinic.address,
          )}`,
        }
      : null,
    clinic?.phone
      ? {
          icon: Phone,
          label: "Phone",
          value: clinic.phone,
          href: `tel:${clinic.phone.replace(/\s+/g, "")}`,
        }
      : null,
    clinic?.email
      ? {
          icon: Mail,
          label: "Email",
          value: clinic.email,
          href: `mailto:${clinic.email}`,
        }
      : null,
  ].filter(Boolean) as {
    icon: typeof MapPin;
    label: string;
    value: string;
    href: string;
  }[];

  return (
    <section id="contact" className="scroll-mt-24 relative overflow-hidden bg-card">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-1/4 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--secondary) 70%, transparent), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 md:px-6 py-16 md:py-24">
        <Reveal className="mb-10 flex flex-col items-center gap-3 text-center">
          <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-primary">
            <MapPin size={14} />
            Contact
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Visit or reach us
          </h2>
          <ClinicStatusBadge clinic={clinic} className="mt-1" />
        </Reveal>

        <div className="grid gap-6 md:grid-cols-[1fr_1.1fr] md:gap-8">
          <Reveal delay={80} className="space-y-4">
            {details.length > 0 ? (
              details.map(({ icon: Icon, label, value, href }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noreferrer" : undefined}
                  className="group flex gap-4 rounded-2xl border border-border bg-background/70 p-5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                >
                  <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="font-medium text-foreground break-words">{value}</p>
                  </div>
                </a>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background/60 p-6 text-center text-sm text-muted-foreground">
                Contact details have not been published yet.
              </div>
            )}
          </Reveal>

          <Reveal delay={160}>
            <div className="h-full rounded-2xl border border-border bg-background/70 p-6 backdrop-blur-sm">
              <div className="mb-5 flex items-center justify-between gap-3">
                <h3 className="font-semibold text-foreground">Opening hours</h3>
                {!openToday && (
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    Closed today
                  </span>
                )}
              </div>
              <ul className="space-y-1">
                {hours.map((day) => (
                  <li
                    key={day.day}
                    className={`flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm transition-colors ${
                      day.day === todayDay
                        ? "bg-primary/10 font-semibold text-primary"
                        : "text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span>{WEEKDAY_LABELS[day.day]}</span>
                    <span className="text-right">
                      {day.isOpen && day.slots.length > 0
                        ? `${formatSlotLabel(day.slots[0])} – ${formatSlotLabel(
                            day.slots[day.slots.length - 1],
                          )}`
                        : "Closed"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
