import { Clock } from "lucide-react";
import type { ClinicSettings } from "@/api/clinic";
import { cn, formatSlotLabel } from "@/lib/utils";

type ClinicStatusBadgeProps = {
  clinic: ClinicSettings | null;
  className?: string;
};

/**
 * Live clinic status. The backend decides `isOpenNow` in clinic time, so this
 * reads honestly at 3 AM, over the lunch break, or on a closed day:
 * "Open now · until 12:00 PM", "Closed · opens 2:00 PM", or "Closed today".
 */
export function ClinicStatusBadge({ clinic, className }: ClinicStatusBadgeProps) {
  const today = clinic?.today;
  const isOpenNow = Boolean(today?.isOpenNow);
  const nextChangeAt = today?.nextChangeAt ?? null;
  const openLaterToday = !isOpenNow && nextChangeAt !== null;

  const label = isOpenNow
    ? "Open now"
    : openLaterToday
      ? "Closed right now"
      : "Closed today";

  const detail = isOpenNow
    ? nextChangeAt
      ? `until ${formatSlotLabel(nextChangeAt)}`
      : null
    : openLaterToday
      ? `opens ${formatSlotLabel(nextChangeAt)}`
      : null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
        isOpenNow
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-neutral-200 bg-neutral-50 text-neutral-500",
        className,
      )}
    >
      <Clock className="size-4" />
      <span>{label}</span>
      {detail && (
        <span className="font-medium text-neutral-600">{detail}</span>
      )}
    </div>
  );
}
