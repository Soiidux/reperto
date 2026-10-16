import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { toId, hasUsableId } from "../../src/utils/ids";

/**
 * `toId` exists because of a bug that produced no symptom at all.
 *
 * The check-in handler populates `appointment.patientId` so the response can
 * show the patient's name. The audit row written alongside it called
 * `String(appointment.patientId)`, which yields `"[object Object]"` for a
 * populated document. `recordAccess` discards an invalid ObjectId, so the row
 * was simply never written — and the PHI audit trail for every check-in was
 * missing with nothing logged, nothing failed, and no test failing.
 *
 * These lock the helper that prevents a recurrence.
 */

const OID = "6aae2dc2e352aa0baa449171";

describe("toId", () => {
  it("reads the id out of a populated document", () => {
    // This is the case that broke: Mongoose's populated subdocument.
    expect(toId({ _id: new mongoose.Types.ObjectId(OID), name: "Someone" })).toBe(OID);
  });

  it("passes a raw ObjectId through", () => {
    const id = new mongoose.Types.ObjectId(OID);
    expect(toId(id)).toBe(OID);
  });

  it("passes a string through", () => {
    expect(toId(OID)).toBe(OID);
  });

  it("is not fooled by an object whose toString looks like an id", () => {
    // A plain object stringifies to "[object Object]"; that must never be
    // mistaken for an id, which is precisely how the original bug hid.
    class Sneaky {
      toString() {
        return OID;
      }
    }
    // No _id property, so there is nothing to read.
    expect(toId(new Sneaky())).toBe("");
  });

  it("returns empty for null, undefined and an empty string", () => {
    expect(toId(null)).toBe("");
    expect(toId(undefined)).toBe("");
    expect(toId("")).toBe("");
  });

  it("returns empty for a populated document whose id was projected away", () => {
    // `select` can exclude _id. Returning "" makes the caller skip the write
    // rather than invent an id that points at the wrong record.
    expect(toId({ name: "No id here" })).toBe("");
  });
});

describe("hasUsableId", () => {
  it("accepts a real id in any of the three shapes", () => {
    expect(hasUsableId(OID)).toBe(true);
    expect(hasUsableId(new mongoose.Types.ObjectId(OID))).toBe(true);
    expect(hasUsableId({ _id: new mongoose.Types.ObjectId(OID) })).toBe(true);
  });

  it("rejects the stringified-object bug", () => {
    // The exact value that previously flowed into recordAccess.
    expect(hasUsableId(String({}))).toBe(false);
    expect(hasUsableId("[object Object]")).toBe(false);
  });

  it("rejects missing values and anything that is not an ObjectId", () => {
    expect(hasUsableId(undefined)).toBe(false);
    expect(hasUsableId(null)).toBe(false);
    expect(hasUsableId("")).toBe(false);
    expect(hasUsableId("not-an-id")).toBe(false);
    expect(hasUsableId("6aae2dc2e352aa0baa44917")).toBe(false); // too short
    expect(hasUsableId("6aae2dc2e352aa0baa4491711")).toBe(false); // too long
  });
});