import { describe, expect, it } from "vitest";
import { formatSlotLabel, formatWindowLabel } from "./utils";

describe("formatSlotLabel", () => {
  it("converts 24-hour HH:mm slots to a 12-hour chip label", () => {
    expect(formatSlotLabel("09:00")).toBe("9:00 AM");
    expect(formatSlotLabel("10:05")).toBe("10:05 AM");
    expect(formatSlotLabel("12:00")).toBe("12:00 PM");
    expect(formatSlotLabel("12:15")).toBe("12:15 PM");
    expect(formatSlotLabel("14:30")).toBe("2:30 PM");
    expect(formatSlotLabel("00:00")).toBe("12:00 AM");
  });

  it("passes through input it cannot parse", () => {
    expect(formatSlotLabel("abc")).toBe("abc");
    expect(formatSlotLabel("")).toBe("");
  });
});

describe("formatWindowLabel", () => {
  it("renders whole days", () => {
    expect(formatWindowLabel(4320)).toBe("3 days");
    expect(formatWindowLabel(1440)).toBe("1 day");
  });

  it("renders whole hours", () => {
    expect(formatWindowLabel(720)).toBe("12 hours");
    expect(formatWindowLabel(120)).toBe("2 hours");
    expect(formatWindowLabel(60)).toBe("1 hour");
  });

  it("renders minutes otherwise", () => {
    expect(formatWindowLabel(45)).toBe("45 minutes");
    expect(formatWindowLabel(15)).toBe("15 minutes");
    expect(formatWindowLabel(1)).toBe("1 minute");
  });
});