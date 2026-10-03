import { useEffect, useState } from "react";

/**
 * Scroll-spy for single-page sections.
 *
 * Reports the id of the section the reader is currently in, or null while
 * they are above the first one (which is what marks "Home" active). The
 * navbar uses this so the highlight follows manual scrolling as well as
 * clicks — tracking the URL hash alone can't do that, since the hash only
 * changes when a link is followed.
 *
 * Scroll work is throttled through requestAnimationFrame and the listeners
 * are passive, so this never blocks scrolling.
 */

/**
 * Which section is "current" for a given scroll position.
 *
 * A section becomes current once its top edge passes the detection line
 * (offsetPx below the viewport top, which sits under the sticky navbar plus
 * each section's scroll-mt). The last such section wins, so the highlight
 * advances in document order and retreats when scrolling back up.
 *
 * Extracted as a pure function so it can be tested without a DOM.
 */
export const pickActiveSection = (
  sectionTops: readonly (number | null)[],
  scrollY: number,
  offsetPx: number,
): number => {
  let current = -1;
  for (let i = 0; i < sectionTops.length; i += 1) {
    const top = sectionTops[i];
    // null means the id wasn't found on the page; skip it.
    if (top === null) continue;
    if (top - offsetPx <= scrollY) current = i;
  }
  return current;
};

export function useActiveSection(
  ids: readonly string[],
  enabled: boolean,
  // Sections rest just below the sticky navbar (scroll-mt-24 = 96px), so the
  // detection line sits a little lower than that.
  offsetPx = 140,
) {
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;

    const compute = () => {
      frame = 0;

      const scrollY = window.scrollY;
      const viewportH = window.innerHeight;
      const pageH = document.documentElement.scrollHeight;

      const tops = ids.map((id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        return el.getBoundingClientRect().top + scrollY;
      });

      // At the very bottom the final section can never reach the detection
      // line (short trailing sections rarely do), so give it the highlight
      // explicitly by walking back to the last id that exists on the page.
      if (scrollY + viewportH >= pageH - 2) {
        for (let i = ids.length - 1; i >= 0; i -= 1) {
          if (tops[i] !== null) {
            setActiveIndex((prev) => (prev === i ? prev : i));
            return;
          }
        }
      }

      const next = pickActiveSection(tops, scrollY, offsetPx);
      setActiveIndex((prev) => (prev === next ? prev : next));
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(compute);
    };

    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    // Sections (and doctor cards) mount asynchronously, so re-measure once
    // the page has settled rather than only at first paint.
    const settleTimer = window.setTimeout(schedule, 400);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [ids, enabled, offsetPx]);

  // -1 (above the first section) maps to no id, which marks "Home" active.
  return activeIndex >= 0 ? (ids[activeIndex] ?? null) : null;
}
