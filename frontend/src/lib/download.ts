import { toast } from "sonner";

/**
 * Starts a browser download for a Blob. Returns true when the download was
 * started, false (with a toast) when the content looked wrong or something
 * unexpected happened.
 *
 * Three browser gotchas handled here:
 *
 * 1. Revoking the object URL (or removing the anchor) immediately after
 *    click() can cancel the transfer before it starts — Safari especially
 *    saves a corrupt or empty file. We keep the anchor in the DOM and only
 *    clean up after a short delay.
 *
 * 2. Order matters for Firefox/Safari: the object URL and the anchor click
 *    happen FIRST, as close to the user's click as possible. The content
 *    check runs after. Some browsers ignore the download attribute (and
 *    navigate the page to the file instead — the "site goes blank" symptom)
 *    for elements created after a long async gap, so we never let the check
 *    delay the actual download.
 *
 * 3. If the server answered with an error body instead of the file (expired
 *    session, not found, ...), the user would silently get a broken file.
 *    We sniff the first bytes afterwards and warn loudly instead.
 */
export const downloadBlob = async (blob: Blob, filename: string): Promise<boolean> => {
  let url: string | null = null;
  try {
    url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    // Keep the anchor alive and the URL valid until the browser has had a
    // chance to start the transfer — then clean up quietly.
    window.setTimeout(() => {
      anchor.remove();
      if (url) URL.revokeObjectURL(url);
    }, 1000);
  } catch (error) {
    console.error("Could not start download:", error);
    if (url) URL.revokeObjectURL(url);
    toast.error("The download couldn't be started. Please try again.");
    return false;
  }

  const expected = expectedFileKind(filename);
  if (expected) {
    try {
      const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
      const headText = String.fromCharCode(...head);
      if (!headText.startsWith(expected.signature)) {
        const snippet = (await blob.slice(0, 160).text()).replace(/\s+/g, " ").trim();
        console.warn(`Download content check failed for ${filename} — got:`, snippet);
        toast.error(
          `The downloaded ${expected.label} looks wrong — the server likely returned an error or your session expired. Details are in the browser console.`,
        );
        return false;
      }
    } catch (error) {
      // The content check is diagnostic only; never block a download on it.
      console.warn(`Could not verify ${filename}:`, error);
    }
  }
  return true;
};

const expectedFileKind = (filename: string): { label: string; signature: string } | null => {
  if (filename.toLowerCase().endsWith(".pdf")) return { label: "PDF", signature: "%PDF" };
  if (filename.toLowerCase().endsWith(".png")) return { label: "image", signature: "\u0089PNG" };
  if (filename.toLowerCase().endsWith(".json")) return { label: "data file", signature: "{" };
  return null;
};