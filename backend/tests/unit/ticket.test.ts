import { describe, expect, it } from "vitest";
import {
  parseTicketReference,
  ticketRef,
  verifyTicket,
} from "../../src/utils/ticket";

const appointment = {
  _id: "64f0c2d9e352aa0baa449171",
  appointmentDate: new Date("2026-09-21T00:00:00.000Z"),
  timeSlot: "09:15",
};

/** The ticket's display date label, derived the same way the util does. */
const expectedDateLabel = () =>
  new Date(appointment.appointmentDate)
    .toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .replace(/\s+/g, "-");

describe("ticketRef", () => {
  it("builds the canonical REPERTO_TICKET reference", () => {
    const ref = ticketRef(appointment);
    expect(ref).toBe(
      `REPERTO_TICKET:${appointment._id}:${expectedDateLabel()}:09:15`,
    );
  });

  it("accepts appointment objects whose _id is a mongoose-like subdoc", () => {
    const ref = ticketRef({
      _id: { _id: "abc123" },
      appointmentDate: appointment.appointmentDate,
      timeSlot: "10:00",
    });
    expect(ref).toContain("abc123");
  });
});

describe("parseTicketReference", () => {
  it("round-trips a canonical reference", () => {
    const ref = ticketRef(appointment);
    expect(parseTicketReference(ref)).toEqual({
      appointmentId: appointment._id,
      date: expectedDateLabel(),
      timeSlot: "09:15",
    });
  });

  it("tolerates surrounding whitespace from scans", () => {
    const ref = ticketRef(appointment);
    expect(parseTicketReference(`  ${ref}  `)).toEqual({
      appointmentId: appointment._id,
      date: expectedDateLabel(),
      timeSlot: "09:15",
    });
  });

  it("rejects strings that are not ticket references", () => {
    expect(parseTicketReference("")).toBeNull();
    expect(parseTicketReference("hello world")).toBeNull();
    expect(parseTicketReference("REPERTO_TICKET:")).toBeNull();
    expect(parseTicketReference(`REPERTO_TICKET:${appointment._id}`)).toBeNull();
    expect(parseTicketReference(`REPERTO_TICKET:${appointment._id}:21-Sept-2026`)).toBeNull();
    expect(parseTicketReference("TICKET:abc:21-Sept-2026:09:00")).toBeNull();
  });
});

describe("verifyTicket", () => {
  it("accepts a ticket that matches the appointment", () => {
    const parsed = parseTicketReference(ticketRef(appointment))!;
    expect(verifyTicket(appointment, parsed)).toEqual({
      valid: true,
      staleDate: false,
      slotMismatch: false,
    });
  });

  it("flags a stale printed date after a reschedule", () => {
    const parsed = parseTicketReference(ticketRef(appointment))!;
    const rescheduled = { ...appointment, appointmentDate: new Date("2026-09-25T00:00:00.000Z") };
    const result = verifyTicket(rescheduled, parsed);
    expect(result.valid).toBe(true);
    expect(result.staleDate).toBe(true);
    expect(result.slotMismatch).toBe(false);
  });

  it("flags a slot mismatch after a reschedule", () => {
    const parsed = parseTicketReference(ticketRef(appointment))!;
    const rescheduled = { ...appointment, timeSlot: "14:30" };
    const result = verifyTicket(rescheduled, parsed);
    expect(result.valid).toBe(true);
    expect(result.slotMismatch).toBe(true);
  });

  it("rejects a code for a different appointment", () => {
    const parsed = parseTicketReference(ticketRef(appointment))!;
    const other = { ...appointment, _id: "65ab1234567890abcdef1234" };
    expect(verifyTicket(other, parsed)).toEqual({ valid: false });
  });
});