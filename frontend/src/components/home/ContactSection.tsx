import { Mail, MapPin, Phone } from "lucide-react";
import type { ClinicSettings } from "@/api/clinic";
import { ClinicStatusBadge } from "@/components/ClinicStatusBadge";
import { formatSlotLabel } from "@/lib/utils";

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

  return (
    <section id="contact" className="scroll-mt-24 w-full bg-white">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-16 md:py-20">
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-primary/70">
            Contact
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">
            Visit or reach us
          </h2>
          <ClinicStatusBadge clinic={clinic} className="mt-2 self-start" />
        </div>

        <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-16">
          <div className="space-y-5">
            {clinic?.address && (
              <div className="flex gap-3">
                <MapPin size={18} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-neutral-900">Address</p>
                  <p className="text-sm text-neutral-600">{clinic.address}</p>
                </div>
              </div>
            )}
            {clinic?.phone && (
              <div className="flex gap-3">
                <Phone size={18} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-neutral-900">Phone</p>
                  <a
                    href={`tel:${clinic.phone.replace(/\s+/g, "")}`}
                    className="text-sm text-neutral-600 hover:text-primary"
                  >
                    {clinic.phone}
                  </a>
                </div>
              </div>
            )}
            {clinic?.email && (
              <div className="flex gap-3">
                <Mail size={18} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold text-neutral-900">Email</p>
                  <a
                    href={`mailto:${clinic.email}`}
                    className="text-sm text-neutral-600 hover:text-primary"
                  >
                    {clinic.email}
                  </a>
                </div>
              </div>
            )}
            {!clinic?.address && !clinic?.phone && !clinic?.email && (
              <p className="text-sm text-neutral-400">
                Contact details have not been published yet.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-5">
            <h3 className="mb-4 font-semibold text-neutral-900">
              Opening hours
            </h3>
            <ul className="space-y-2">
              {hours.map((day) => (
                <li
                  key={day.day}
                  className="flex items-center justify-between gap-4 text-sm"
                >
                  <span
                    className={
                      day.day === todayDay
                        ? "font-semibold text-primary"
                        : "text-neutral-600"
                    }
                  >
                    {WEEKDAY_LABELS[day.day]}
                  </span>
                  <span className="text-right text-neutral-500">
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
        </div>
      </div>
    </section>
  );
}
