import { describe, expect, it } from "vitest";
import {
  DEFAULT_DAY_SLOTS,
  buildDefaultSettings,
  formatWindow,
  getClinicLiveStatus,
  getClinicWeekday,
} from "../../src/utils/clinicSettings";
import { parseDateAnchor } from "../../src/utils/clinicDate";
import { timeToMinutes } from "../../src/utils/availability";

describe("timeToMinutes", () => {
  it("parses 12-hour clinical slots from legacy data", () => {
    expect(timeToMinutes("09:15 AM")).toBe(555);
    expect(timeToMinutes("02:30 PM")).toBe(870);
    expect(timeToMinutes("12:00 PM")).toBe(720);
    expect(timeToMinutes("12:15 AM")).toBe(15);
  });

  it("parses 24-hour HH:mm slots", () => {
    expect(timeToMinutes("09:00")).toBe(540);
    expect(timeToMinutes("14:30")).toBe(870);
    expect(timeToMinutes("00:00")).toBe(0);
  });
});

describe("formatWindow", () => {
  it("renders whole days", () => {
    expect(formatWindow(4320)).toBe("3 days");
    expect(formatWindow(1440)).toBe("1 day");
  });

  it("renders whole hours", () => {
    expect(formatWindow(720)).toBe("12 hours");
    expect(formatWindow(120)).toBe("2 hours");
    expect(formatWindow(60)).toBe("1 hour");
  });

  it("renders minutes otherwise", () => {
    expect(formatWindow(45)).toBe("45 minutes");
    expect(formatWindow(15)).toBe("15 minutes");
    expect(formatWindow(1)).toBe("1 minute");
    expect(formatWindow(0)).toBe("0 minutes");
  });
});

describe("parseDateAnchor", () => {
  it("turns a YYYY-MM-DD string into its UTC-midnight anchor", () => {
    const date = parseDateAnchor("2026-09-21");
    expect(date).not.toBeNull();
    expect(date!.getTime()).toBe(Date.UTC(2026, 8, 21));
  });

  it("rejects impossible or malformed dates", () => {
    expect(parseDateAnchor("2026-02-31")).toBeNull();
    expect(parseDateAnchor("2026-13-01")).toBeNull();
    expect(parseDateAnchor("2026-9-1")).toBeNull();
    expect(parseDateAnchor("garbage")).toBeNull();
    expect(parseDateAnchor("")).toBeNull();
  });
});

describe("default slot grid", () => {
  it("builds the classic day on a 15-minute step", () => {
    expect(DEFAULT_DAY_SLOTS).toHaveLength(24);
    expect(DEFAULT_DAY_SLOTS[0]).toBe("09:00");
    expect(DEFAULT_DAY_SLOTS[15]).toBe("12:45");
    expect(DEFAULT_DAY_SLOTS[16]).toBe("14:00");
    expect(DEFAULT_DAY_SLOTS[23]).toBe("15:45");
    // The 1-2 PM lunch break is not part of the grid, and the day ends at 4 PM.
    expect(DEFAULT_DAY_SLOTS).not.toContain("13:00");
    expect(DEFAULT_DAY_SLOTS).not.toContain("16:00");
  });

  it("only ever emits quarter-hour starts", () => {
    for (const slot of DEFAULT_DAY_SLOTS) {
      expect(Number(slot.slice(3)) % 15).toBe(0);
    }
  });
});

describe("buildDefaultSettings", () => {
  const settings = buildDefaultSettings();

  it("mints sane out-of-the-box values", () => {
    expect(settings.clinicName).toBe("Reperto Homeopathic Clinic");
    expect(settings.cancellationWindowMinutes).toBe(120);
    expect(settings.hours).toHaveLength(7);
  });

  it("keeps Sundays closed and weekdays on the default grid", () => {
    const sunday = settings.hours.find((h) => h.day === 0)!;
    expect(sunday.isOpen).toBe(false);
    expect(sunday.slots).toEqual([]);

    const monday = settings.hours.find((h) => h.day === 1)!;
    expect(monday.isOpen).toBe(true);
    expect(monday.slots).toEqual(DEFAULT_DAY_SLOTS);
  });
});

describe("getClinicWeekday", () => {
  it("resolves the weekday in the clinic timezone", () => {
    expect(getClinicWeekday(new Date("2026-09-20T04:00:00.000Z"))).toBe(0); // Sunday
    expect(getClinicWeekday(new Date("2026-09-21T04:00:00.000Z"))).toBe(1); // Monday
    // Late UTC evening that is already the next day in Asia/Kolkata.
    expect(getClinicWeekday(new Date("2026-09-20T20:00:00.000Z"))).toBe(1);
  });
});

describe("getClinicLiveStatus", () => {
  const openDay = { day: 1, isOpen: true, slots: DEFAULT_DAY_SLOTS };
  const closedDay = { day: 0, isOpen: false, slots: [] };
  const at = (time: string) => timeToMinutes(time);

  it("is open inside a session and closed outside clinic hours", () => {
    expect(getClinicLiveStatus(openDay, at("10:00")).isOpenNow).toBe(true);
    expect(getClinicLiveStatus(openDay, at("15:00")).isOpenNow).toBe(true);
    // 3 AM, a minute before opening, the closing minute, and the evening.
    expect(getClinicLiveStatus(openDay, at("03:00")).isOpenNow).toBe(false);
    expect(getClinicLiveStatus(openDay, at("08:45")).isOpenNow).toBe(false);
    expect(getClinicLiveStatus(openDay, at("16:00")).isOpenNow).toBe(false);
    expect(getClinicLiveStatus(openDay, at("23:30")).isOpenNow).toBe(false);
  });

  it("treats the gaps between sessions (lunch) as closed", () => {
    const lunch = getClinicLiveStatus(openDay, at("13:15"));
    expect(lunch.isOpenNow).toBe(false);
    // Closed for lunch, and it says when it reopens.
    expect(lunch.nextChangeAt).toBe("14:00");
  });

  it("reports when the current session ends", () => {
    expect(getClinicLiveStatus(openDay, at("10:07")).nextChangeAt).toBe("10:15");
    // Past the last session there is nothing left to flip to.
    expect(getClinicLiveStatus(openDay, at("18:00")).nextChangeAt).toBeNull();
  });

  it("exposes the day's first open and last close times", () => {
    const status = getClinicLiveStatus(openDay, at("10:00"));
    expect(status.opensAt).toBe("09:00");
    expect(status.closesAt).toBe("16:00");
  });

  it("is closed all day when the day has no slots", () => {
    expect(getClinicLiveStatus(closedDay, at("10:00"))).toEqual({
      isOpenNow: false,
      opensAt: null,
      closesAt: null,
      nextChangeAt: null,
    });
  });

  it("ignores unsorted slot data", () => {
    const scrambled = { day: 1, isOpen: true, slots: ["15:45", "09:00", "14:00"] };
    const afternoon = getClinicLiveStatus(scrambled, at("14:07"));
    expect(afternoon.isOpenNow).toBe(true);
    expect(afternoon.nextChangeAt).toBe("14:15");
    expect(afternoon.opensAt).toBe("09:00");
    expect(afternoon.closesAt).toBe("16:00");
  });
});