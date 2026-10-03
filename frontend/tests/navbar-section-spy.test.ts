import { describe, expect, it } from "vitest";
import { pickActiveSection } from "../src/hooks/use-active-section";

/**
 * The navbar highlight is driven by pickActiveSection (see the hook), so
 * these tests pin the geometry rule it depends on: which section counts as
 * "current" for a given scroll position.
 */

// Sections rest just below the sticky navbar (h-16 = 64px) plus their
// scroll-mt-24 (96px), so the detection line sits at 140px.
const OFFSET = 140;

const IDS = ["about", "doctors", "contact"] as const;
// Realistic document offsets, in the same order as IDS.
const TOPS: Record<string, number> = { about: 900, doctors: 1800, contact: 2600 };

const topsFor = (ids: readonly string[] = IDS) => ids.map((id) => TOPS[id]);

describe("pickActiveSection", () => {
  it("returns -1 above the first section, so Home stays highlighted", () => {
    expect(pickActiveSection(topsFor(), 0, OFFSET)).toBe(-1);
    expect(pickActiveSection(topsFor(), 500, OFFSET)).toBe(-1);
  });

  it("activates a section once its top passes the detection line", () => {
    // "about" starts at 900, so it becomes current at 900 - 140 = 760.
    expect(pickActiveSection(topsFor(), 759, OFFSET)).toBe(-1);
    expect(pickActiveSection(topsFor(), 760, OFFSET)).toBe(0);
  });

  it("keeps the section active while it occupies the viewport", () => {
    expect(pickActiveSection(topsFor(), 1200, OFFSET)).toBe(0);
  });

  it("advances through sections in document order", () => {
    expect(pickActiveSection(topsFor(), 1660, OFFSET)).toBe(1);
    expect(pickActiveSection(topsFor(), 2460, OFFSET)).toBe(2);
  });

  it("retreats correctly when scrolling back up", () => {
    expect(pickActiveSection(topsFor(), 2000, OFFSET)).toBe(1);
    expect(pickActiveSection(topsFor(), 1000, OFFSET)).toBe(0);
    expect(pickActiveSection(topsFor(), 100, OFFSET)).toBe(-1);
  });

  it("skips ids that are absent from the page", () => {
    // A missing middle section must not stop the later one from matching.
    expect(pickActiveSection([null, null, TOPS.contact], 2500, OFFSET)).toBe(2);
    expect(pickActiveSection([null, null, null], 2500, OFFSET)).toBe(-1);
  });

  it("handles an empty section list", () => {
    expect(pickActiveSection([], 0, OFFSET)).toBe(-1);
  });

  it("handles the very bottom of the document", () => {
    // The last section is current once fully scrolled past.
    expect(pickActiveSection(topsFor(), 3000, OFFSET)).toBe(2);
  });
});
