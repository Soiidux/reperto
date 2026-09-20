import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type ErrorPayload = {
  response?: { data?: { message?: string; errors?: Record<string, string[]> } }
  message?: string
  code?: string
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback
  if (typeof err === "string") return err
  if (typeof err === "object") {
    const payload = err as ErrorPayload

    // Backend unreachable / CORS blocked: no response at all
    if (payload.code === "ERR_NETWORK") {
      return "Cannot reach the server. Check your connection and try again."
    }

    const data = payload.response?.data
    // Validation failures carry per-field messages; surface the first one
    const firstFieldError = data?.errors
      ? Object.values(data.errors).flat()[0]
      : undefined

    return (
      firstFieldError ||
      data?.message ||
      payload.message ||
      (err instanceof Error && err.message) ||
      fallback
    )
  }
  return fallback
}

// "14:30" -> "2:30 PM"; "09:00" -> "9:00 AM". Slot strings from the backend
// are 24-hour "HH:mm"; this renders them the way patients expect on chips.
export function formatSlotLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (m === undefined || Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

// 120 -> "2 hours"; 4320 -> "3 days"; 45 -> "45 minutes". Matches the
// backend's copy so the booking screen and the admin page tell the same story.
export function formatWindowLabel(minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1 day" : `${days} days`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}
