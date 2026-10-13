import { describe, expect, it } from "vitest";
import {
  buildUserSearchFilter,
  escapeRegex,
  USER_SEARCH_COLLATION,
} from "../../src/utils/userSearch";

/**
 * Directory search used to embed raw input into `$regex`. MongoDB does not use
 * an index for `$regex` (verified with explain()), so every keystroke scanned
 * the collection — and unescaped input could change the query's meaning. The
 * search is now a lexicographic range, which *is* indexable.
 *
 * These lock the filter shape. The index actually being used is covered by the
 * live explain check in tests/api/search.test.ts.
 */

type Range = { $gte: string; $lt: string };
type Clause = Record<string, Range | { $regex: string }>;

const clauses = (filter: Record<string, unknown> | null): Clause[] =>
  (filter?.$or ?? []) as Clause[];

/** The range or regex the filter applies to one field. */
const constraintFor = (filter: Record<string, unknown> | null, field: string) => {
  const clause = clauses(filter).find((c) => field in c);
  return clause?.[field];
};

const fields = (filter: Record<string, unknown> | null) =>
  clauses(filter).map((c) => Object.keys(c)[0]).sort();

describe("escapeRegex", () => {
  it("neutralises regex metacharacters so input is matched literally", () => {
    // Unescaped, a bare "." would match any character.
    expect(escapeRegex("a.b")).toBe("a\\.b");
    expect(escapeRegex("(a|b)+")).toBe("\\(a\\|b\\)\\+");
    expect(escapeRegex(".*")).toBe("\\.\\*");
  });

  it("leaves ordinary input untouched", () => {
    expect(escapeRegex("john")).toBe("john");
    expect(escapeRegex("Dr Smith")).toBe("Dr Smith");
  });
});

describe("buildUserSearchFilter", () => {
  it("returns null for empty or non-string input, so no filter is applied", () => {
    expect(buildUserSearchFilter(undefined)).toBeNull();
    expect(buildUserSearchFilter("")).toBeNull();
    expect(buildUserSearchFilter("   ")).toBeNull();
    // Express hands over an array for ?search=a&search=b; ignore it rather
    // than stringifying it into a nonsense filter.
    expect(buildUserSearchFilter(["a", "b"])).toBeNull();
    expect(buildUserSearchFilter({ a: 1 })).toBeNull();
  });

  it("covers name, email and phone — every \$or branch must be indexable", () => {
    expect(fields(buildUserSearchFilter("jo"))).toEqual([
      "email",
      "name",
      "phone",
    ]);
  });

  it("uses a lexicographic range, not \$regex, so the index is usable", () => {
    const name = constraintFor(buildUserSearchFilter("demo"), "name") as Range;
    expect(name.$gte).toBe("demo");
    // "demp" sorts immediately after every string starting with "demo".
    expect(name.$lt).toBe("demp");
    expect(name).not.toHaveProperty("$regex");
  });

  it("computes the upper bound by incrementing the last character", () => {
    const cases: [string, string][] = [
      ["a", "b"],
      ["az", "a{"],
      ["demo", "demp"],
    ];
    for (const [term, expectedUpper] of cases) {
      expect(
        (constraintFor(buildUserSearchFilter(term), "name") as Range).$lt,
      ).toBe(expectedUpper);
    }
  });

  it("handles a single-character term and an empty prefix safely", () => {
    expect((constraintFor(buildUserSearchFilter("z"), "name") as Range).$lt).toBe("{");
    // A prefix that is already all 0xffff must widen rather than overflow.
    expect(
      (constraintFor(buildUserSearchFilter("\uffff"), "name") as Range).$lt,
    ).toBe("\uffff\uffff");
  });

  it("applies the same range to every branch", () => {
    const filter = buildUserSearchFilter("demo");
    const name = constraintFor(filter, "name");
    const email = constraintFor(filter, "email");
    const phone = constraintFor(filter, "phone");
    // Identical shapes across branches, or Mongo cannot plan an index union.
    expect(name).toEqual(email);
    expect(email).toEqual(phone);
  });

  it("matches identifiers anywhere, because nobody types an email from the @", () => {
    for (const term of ["john@clinic.com", "9876543210", "98765"]) {
      const email = constraintFor(buildUserSearchFilter(term), "email") as {
        $regex: string;
      };
      expect(email.$regex).toBeDefined();
      // No lower bound: this branch is a scan, honestly labelled as one.
      expect(email).not.toHaveProperty("$gte");
    }
  });

  it("escapes the identifier regex", () => {
    const email = constraintFor(
      buildUserSearchFilter("john+tag@clinic.com"),
      "email",
    ) as { $regex: string };
    expect(email.$regex).toBe("john\\+tag@clinic\\.com");
  });

  it("trims surrounding whitespace before building the range", () => {
    expect((constraintFor(buildUserSearchFilter("  demo  "), "name") as Range).$gte).toBe(
      "demo",
    );
  });
});

describe("USER_SEARCH_COLLATION", () => {
  it("is case-insensitive, which is what makes the range indexable", () => {
    // strength 2 = case-insensitive. The User indexes are declared with this
    // exact collation; if the two diverge Mongo silently stops using them.
    expect(USER_SEARCH_COLLATION.locale).toBe("en");
    expect(USER_SEARCH_COLLATION.strength).toBe(2);
  });
});