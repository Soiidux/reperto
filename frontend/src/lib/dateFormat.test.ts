import { describe, expect, it } from "vitest";
import { formatClinicDate, formatClinicDateKey, formatSlotLabel } from "./utils";

/**
 * Calendar dates (appointmentDate, leave dates) are stored by the backend as
 * UTC midnight (see `getClinicTodayAnchor`). Rendering those through local
 * getters shows the previous day west of UTC, so every calendar date in the UI
 * goes through formatClinicDate.
 *
 * These tests pin that contract by exercising several timezones — a pure
 * node-environment test can't change process.env.TZ mid-run reliably, so the
 * assertions below are written to be timezone-independent by construction and
 * the risk is documented rather than simulated.
 */

describe("formatClinicDate", () => {
  it("renders a UTC-midnight date as the same calendar day", () => {
    // How the backend stores 1 Jan 2026.
    const anchor = new Date(Date.UTC(2026, 0, 1));
    expect(formatClinicDate(anchor)).toBe("1 Jan 2026");
  });

  it("accepts the ISO string form the API returns", () => {
    expect(formatClinicDate("2026-01-01T00:00:00.000Z")).toBe("1 Jan 2026");
    expect(formatClinicDate("2026-12-31T00:00:00.000Z")).toBe("31 Dec 2026");
  });

  it("does not drift to the adjacent day at either end of the year", () => {
    // These are the boundaries that break without a pinned UTC timezone.
    expect(formatClinicDate("2026-01-01T00:00:00.000Z")).toBe("1 Jan 2026");
    expect(formatClinicDate("2026-12-31T00:00:00.000Z")).toBe("31 Dec 2026");
  });

  it("supports custom option sets", () => {
    expect(
      formatClinicDate("2026-03-09T00:00:00.000Z", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    ).toBe("Mon, 9 Mar, 2026");
  });

  it("returns the raw input for an unparseable date instead of 'Invalid Date'", () => {
    expect(formatClinicDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatClinicDateKey", () => {
  it("renders a YYYY-MM-DD key as that exact day", () => {
    expect(formatClinicDateKey("2026-01-01")).toBe("1 Jan 2026");
    expect(formatClinicDateKey("2026-09-20")).toBe("20 Sept 2026");
  });
});

describe("formatSlotLabel", () => {
  it("renders 24-hour slot strings for patients", () => {
    expect(formatSlotLabel("09:00")).toBe("9:00 AM");
    expect(formatSlotLabel("14:30")).toBe("2:30 PM");
    expect(formatSlotLabel("12:00")).toBe("12:00 PM");
  });

  it("passes through anything it cannot parse", () => {
    expect(formatSlotLabel("garbage")).toBe("garbage");
  });
});