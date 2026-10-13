/**
 * User search filters for the directory and admin search boxes.
 *
 * The previous implementation embedded raw input into `$regex`, which had two
 * problems:
 *
 *   1. MongoDB does **not** use an index for `$regex` — verified with
 *      `.explain('queryPlanner')`, which reported COLLSCAN even with matching
 *      indexes on every field in the `$or`.
 *   2. The input was not escaped, so a stray `(` or `.*` changed the query's
 *      meaning.
 *
 * A lexicographic range ([term, term-upper-bound)) *is* indexable, and it
 * expresses the same "starts with" intent. With a case-insensitive collation on
 * every branch, the `$or` resolves to an index union (3 × IXSCAN) instead of a
 * collection scan.
 *
 * Two details matter and are easy to get wrong:
 *   - EVERY branch of the `$or` needs an index carrying the same collation,
 *     or Mongo falls back to a single COLLSCAN for the whole query.
 *   - the query collation must match the index collation exactly.
 */

/**
 * Locale/strength for both the indexes (User model) and these queries.
 * strength 2 = case-insensitive, which is what makes "Jo" match "john".
 */
export const USER_SEARCH_COLLATION = {
  locale: "en",
  strength: 2 as const,
};

/**
 * The lexicographic upper bound for a prefix: "demo" -> "demp".
 *
 * Increments the final code unit rather than appending a sentinel character,
 * because the increment sorts immediately after every string sharing the
 * prefix — including ones containing the sentinel. Handle the empty string
 * explicitly, since incrementing "" has no last character to bump.
 */
const prefixUpperBound = (term: string): string => {
  if (term.length === 0) return "\uffff";
  const last = term.charCodeAt(term.length - 1);
  // A trailing \uffff has nowhere to go; widen the prefix instead.
  if (last === 0xffff) return `${term}\uffff`;
  return `${term.slice(0, -1)}${String.fromCharCode(last + 1)}`;
};

/** Case-insensitive "starts with" range, served from an index. */
const prefixRange = (term: string) => ({
  $gte: term,
  $lt: prefixUpperBound(term),
});

/** Fields the directory search covers. */
const SEARCHABLE_FIELDS = ["name", "email", "phone"] as const;

/**
 * Filter for the user/patient search boxes.
 *
 * Accepts the raw `req.query` value: Express types a query param as
 * string | ParsedQs | (string | ParsedQs)[], so `?search=a&search=b` arrives
 * as an array. Anything that isn't a plain string is ignored rather than
 * stringified into a bogus filter.
 *
 * A term containing "@" or a digit run is matched anywhere in the field rather
 * than by prefix, because people paste whole emails and phone numbers instead
 * of typing their first character. That branch cannot use an index, which is
 * the honest cost of matching what users actually do.
 */
export const buildUserSearchFilter = (
  search: unknown,
): Record<string, unknown> | null => {
  if (typeof search !== "string") return null;
  const term = search.trim();
  if (!term) return null;

  if (term.includes("@") || /\d{3,}/.test(term)) {
    // Identifier lookup. Escaped, because this is still a regex — the one
    // place we keep them.
    const anywhere = { $regex: escapeRegex(term) };
    return { $or: SEARCHABLE_FIELDS.map((field) => ({ [field]: anywhere })) };
  }

  const range = prefixRange(term);
  return { $or: SEARCHABLE_FIELDS.map((field) => ({ [field]: range })) };
};

/**
 * Escape regex metacharacters so user input is matched literally. Only needed
 * on the identifier branch, but kept exported: it is the correct thing to do
 * anywhere a value reaches a `$regex`, and other controllers embed search
 * terms the same way.
 */
export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");