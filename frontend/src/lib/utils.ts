import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type ErrorPayload = {
  response?: { data?: { message?: string } }
  message?: string
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback
  if (typeof err === "string") return err
  if (err instanceof Error && err.message) return err.message
  if (typeof err === "object") {
    const payload = err as ErrorPayload
    return payload.response?.data?.message || payload.message || fallback
  }
  return fallback
}
