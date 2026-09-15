import InvoiceCounter from "../db/models/invoiceCounter.model";

/**
 * Human-friendly sequential number: INV-<year>-<4-digit seq>.
 * Atomically increments a per-year counter so concurrent generations
 * never collide.
 */
export const generateInvoiceNumber = async (): Promise<string> => {
  const year = new Date().getUTCFullYear();

  const counter = await InvoiceCounter.findOneAndUpdate(
    { year },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );

  return `INV-${year}-${String(counter.seq).padStart(4, "0")}`;
};