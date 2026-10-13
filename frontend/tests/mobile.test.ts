import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Mobile regression guard.
 *
 * These assert facts about the *built class names* rather than rendering,
 * because the frontend has no DOM test environment. The failures this guards
 * are all silent: an element still exists, it is just off-screen or
 * overflowing on a phone, which no unit test would otherwise notice.
 *
 * If the frontend gains jsdom/RTL, convert these to real render assertions —
 * the intent is "reachable and not overflowing on a 375px viewport".
 */

// Resolved against the repo's src/ directory, so paths here read naturally
// ("components/Navbar.tsx") and don't depend on this file's location.
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

const read = (relative: string) => readFileSync(join(SRC, relative), "utf8");

describe("mobile: public navigation", () => {
  const navbar = read("components/Navbar.tsx");

  it("keeps a mobile menu trigger", () => {
    // Without this the section links are `hidden md:flex` and a phone visitor
    // has no navigation at all.
    expect(navbar).toContain("md:hidden");
    expect(navbar).toContain('aria-label="Open menu"');
    expect(navbar).toContain("Open menu");
  });

  it("offers every section inside the mobile menu, not just on desktop", () => {
    // Each label is declared once in NAV_LINKS...
    for (const label of ["Home", "About", "Doctors", "Contact"]) {
      expect(navbar).toMatch(
        new RegExp(`label:\\s*'${label}'`),
        `NAV_LINKS is missing ${label}`,
      );
    }
    // ...and the sheet renders from that same list, so the mobile menu can
    // never drift out of sync with the desktop one.
    const sheetBlock = navbar.slice(navbar.indexOf("<SheetContent"));
    expect(sheetBlock).toContain("NAV_LINKS.map");
  });

  it("gives mobile users a route to sign in and register", () => {
    const sheetBlock = navbar.slice(navbar.indexOf("<SheetContent"));
    expect(sheetBlock).toContain('to="/login"');
    expect(sheetBlock).toContain('to="/register"');
  });

  it("closes the menu before scrolling, so the sheet is not over the section", () => {
    const sheetBlock = navbar.slice(navbar.indexOf("<SheetContent"));
    expect(sheetBlock).toContain("setMenuOpen(false)");
    // setMenuOpen must run before goToSection within the same handler.
    expect(sheetBlock.indexOf("setMenuOpen(false)")).toBeLessThan(
      sheetBlock.indexOf("goToSection(hash)"),
    );
  });
});

describe("mobile: no fixed-width overflow", () => {
  it("never hard-codes a width that exceeds a 375px viewport", () => {
    const forms = [
      "components/LoginForm.tsx",
      "pages/ForgotPassword.tsx",
      "pages/ResetPassword.tsx",
      "pages/VerifyEmail.tsx",
    ];
    for (const file of forms) {
      const src = read(file);
      // A bare `w-[400px]` forces horizontal scrolling on a phone.
      expect(src, `${file} must not use a fixed width`).not.toMatch(
        /className="w-\[\d+px\]/,
      );
      // The fluid equivalent is required instead.
      expect(src).toMatch(/w-full max-w-\[\d+px\]/);
    }
  });
});

describe("mobile: dashboard shell", () => {
  const layout = read("layouts/DashboardLayout.tsx");

  it("scales main padding down on small screens", () => {
    // p-8 unconditionally costs 64px of a 375px viewport.
    expect(layout).toMatch(/p-4 md:p-8/);
    expect(layout).not.toMatch(/overflow-y-auto p-8/);
  });

  it("keeps the header row from overflowing", () => {
    // min-w-0 lets the role label truncate; without it the row pushes wider
    // than the viewport.
    expect(layout).toContain("min-w-0");
    // The decorative date is the first thing to go when space is tight.
    expect(layout).toContain("hidden md:block");
  });

  it("hides the wide desktop CTA on mobile, where the sheet replaces it", () => {
    const navbar = read("components/Navbar.tsx");
    expect(navbar).toContain("hidden md:flex items-center gap-4");
  });
});