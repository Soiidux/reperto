/**
 * Reading an id out of something that may or may not be populated.
 *
 * Mongoose returns a raw `ObjectId` from `findById`, but an embedded document
 * as soon as the query adds `.populate()`. Those two stringify very differently:
 * `String(populatedDoc)` is `"[object Object]"`, not an id.
 *
 * That is not hypothetical here. `checkInByTicket` populates `patientId` to show
 * the patient's name, so the audit row written alongside it called
 * `String(appointment.patientId)`, produced `"[object Object]"`, and
 * `recordAccess` — which silently discards an invalid ObjectId — never wrote the
 * row at all. The PHI audit trail for check-ins was missing entirely, and
 * nothing failed.
 *
 * The failure is silent, which is what makes it dangerous: adding a `.populate()`
 * to a query is an innocuous-looking change that turns an audit row into a
 * no-op. Using this helper everywhere the question can arise means that change
 * cannot break auditing, and it reads correctly at every call site.
 */

/**
 * The id of a possibly-populated reference.
 *
 * Handles the three shapes seen in this codebase: a populated document
 * (`{ _id }`), a raw ObjectId, and a plain string (as `req.params` provides).
 */
export const toId = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const candidate = value as { _id?: unknown };
    if ("_id" in candidate) return String(candidate._id);
    // A populated document whose id was projected away. Returning "" is correct:
    // the caller is about to hand it to something that rejects a bad ObjectId,
    // and an empty string fails that the same way a wrong one would — but
    // without pretending to have found an id.
    return "";
  }
  return String(value);
};

/**
 * Whether a value carries a usable id. Use this to *skip* audit work rather
 * than to build a placeholder.
 */
export const hasUsableId = (value: unknown): boolean => {
  const id = toId(value);
  return /^[a-f0-9]{24}$/i.test(id);
};