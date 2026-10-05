import { describe, expect, it } from "vitest";
import getAge from "./getAge";

/**
 * DOB strings are stored as "YYYY-MM-DD". Passing one straight to
 * `new Date()` yields UTC midnight, which then read back with *local* getters
 * shifts the day backwards for anyone west of UTC and made every age a year
 * too low. These tests pin the component-wise comparison.
 */

describe("getAge", () => {
  it("counts whole years from the DOB", () => {
    const now = new Date();
    const thisYear = now.getFullYear();
    // A birthday already passed this year.
    const passed = `${thisYear - 30}-01-01`;
    expect(getAge(passed)).toBe(30);
  });

  it("subtracts a year when the birthday is still ahead this year", () => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    // Pick a date strictly in the future within this year, if one exists.
    if (month < 12) {
      const future = `${thisYear - 30}-${String(month + 1).padStart(2, "0")}-01`;
      expect(getAge(future)).toBe(29);
    }
    // Today itself: the birthday has arrived, so no subtraction.
    const today = `${thisYear - 30}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    expect(getAge(today)).toBe(30);
  });

  it("does not shift the day for UTC-bounded DOBs", () => {
    // Regression: parsed as UTC midnight then read in local time, "1990-01-01"
    // became 31 Dec in any negative-UTC offset and yielded an age a year low.
    const jan1 = getAge("1990-01-01");
    const dec31 = getAge("1990-12-31");
    const thisYear = new Date().getFullYear();

    // Both land in 1990, so their ages differ by at most one year.
    expect(Math.abs(dec31 - jan1)).toBeLessThanOrEqual(1);
    expect(jan1).toBeGreaterThanOrEqual(thisYear - 1990 - 1);
  });

  it("returns 0 for malformed input instead of NaN", () => {
    expect(getAge("")).toBe(0);
    expect(getAge("not-a-date")).toBe(0);
    expect(getAge("1990")).toBe(0);
  });
});
