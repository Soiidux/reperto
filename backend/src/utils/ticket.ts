/**
 * Ticket reference utilities for the patient e-ticket.
 *
 * The QR on a booking ticket encodes
 *   REPERTO_TICKET:<appointmentId>:<date>:<timeSlot>
 * where <date> is the display-style "21-Sep-2026" of the appointment's
 * UTC-midnight date and <timeSlot> is "HH:mm". The ticket controller renders
 * this into the QR; the reception check-in endpoint verifies it.
 *
 * The appointment _id is the machine anchor — it uniquely identifies the
 * booking. The date/time segments are human verification and stay informative
 * after a reschedule (the printed ticket simply predates the new slot).
 */

import { toId } from "./ids";

export const TICKET_PREFIX = "REPERTO_TICKET:";

/** "21-Sep-2026" — the display date a ticket prints for a UTC-midnight appointment date. */
const ticketDateLabel = (date: Date): string =>
  new Date(date)
    .toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .replace(/\s+/g, "-");

/** Canonical machine-verifiable reference baked into the ticket QR image. */
export const ticketRef = (appointment: {
  _id: unknown;
  appointmentDate: Date | string;
  timeSlot: string;
}): string =>
  `${TICKET_PREFIX}${toId(appointment._id)}:${ticketDateLabel(new Date(appointment.appointmentDate))}:${appointment.timeSlot}`;

export interface TicketReference {
  appointmentId: string;
  /** Display-style date printed on the ticket, e.g. "21-Sep-2026". */
  date: string;
  /** "HH:mm" slot printed on the ticket, e.g. "09:15". */
  timeSlot: string;
}

/**
 * Parses a scanned or typed ticket code. Returns null when it isn't a
 * well-formed ticket reference (wrong prefix, missing segments).
 */
export const parseTicketReference = (code: string): TicketReference | null => {
  const trimmed = (code ?? "").trim();
  if (!trimmed.startsWith(TICKET_PREFIX)) return null;
  const rest = trimmed.slice(TICKET_PREFIX.length);
  const firstColon = rest.indexOf(":");
  if (firstColon <= 0) return null;
  const appointmentId = rest.slice(0, firstColon);
  const segments = rest.slice(firstColon + 1).split(":");
  // Canonical form is <date>:<hh>:<mm>; take the first three segments so a
  // stray extra ":" in a mangled scan can't break lookup.
  if (segments.length < 3) return null;
  const [date, hour, minute] = segments;
  if (!appointmentId || !date || !hour || !minute) return null;
  return { appointmentId, date, timeSlot: `${hour}:${minute}` };
};

export interface TicketVerification {
  /** True when the code's appointment id matches the loaded appointment. */
  valid: boolean;
  /** Printed date differs from the appointment's date (e.g. after a reschedule). */
  staleDate?: boolean;
  /** Printed slot differs from the appointment's current slot (rescheduled). */
  slotMismatch?: boolean;
}

/**
 * Verifies a parsed ticket against the appointment it claims to reference.
 * The id must match; date/slot differences after a reschedule are reported
 * as informational flags so the desk can still check the patient in.
 */
export const verifyTicket = (
  appointment: { _id: unknown; appointmentDate: Date | string; timeSlot: string },
  parsed: TicketReference,
): TicketVerification => {
  if (parsed.appointmentId !== toId(appointment._id)) return { valid: false };
  const [date, ...timeSegments] = ticketRef(appointment).split(":").slice(2);
  return {
    valid: true,
    staleDate: parsed.date !== date,
    slotMismatch: parsed.timeSlot !== timeSegments.join(":"),
  };
};