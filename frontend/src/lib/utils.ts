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
