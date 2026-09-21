import { describe, expect, it } from "vitest";
import { normalizeTicketCode } from "./ticket";

const SAMPLE = "REPERTO_TICKET:6aae2dc2e352aa0baa449171:21-Sep-2026:09:15";

describe("normalizeTicketCode", () => {
  it("passes a well-formed code through unchanged", () => {
    expect(normalizeTicketCode(SAMPLE)).toBe(SAMPLE);
  });

  it("strips whitespace and the Enter that USB scanners append", () => {
    expect(normalizeTicketCode(`  ${SAMPLE}\r\n`)).toBe(SAMPLE);
    expect(normalizeTicketCode(`\n${SAMPLE} \n`)).toBe(SAMPLE);
    expect(normalizeTicketCode(`${SAMPLE}\r`)).toBe(SAMPLE);
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(normalizeTicketCode("")).toBeNull();
    expect(normalizeTicketCode("   \n  ")).toBeNull();
    expect(normalizeTicketCode(null)).toBeNull();
    expect(normalizeTicketCode(undefined)).toBeNull();
  });
});