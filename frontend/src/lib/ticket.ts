/**
 * Ticket-code helpers for the reception check-in screen.
 *
 * A QR encodes `REPERTO_TICKET:<appointmentId>:<date>:<timeSlot>` (see
 * backend/src/utils/ticket.ts). Camera scans decode it byte-for-byte, but a
 * USB barcode scanner "types" the code and presses Enter, so manual entry
 * arrives with trailing line breaks; a camera scan can also pick up stray
 * whitespace. Normalize before sending to the backend — which trims too, but
 * the client keeps the payload tidy and stops blank input before it hammers
 * the API.
 */

/** Trims scan/type artifacts (whitespace, newlines) or returns null when empty. */
export const normalizeTicketCode = (
  raw: string | null | undefined
): string | null => {
  const cleaned = (raw ?? "").trim();
  return cleaned.length > 0 ? cleaned : null;
};