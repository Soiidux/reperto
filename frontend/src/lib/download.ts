import { toast } from "sonner";

/**
 * Triggers a browser download for a Blob, then frees the object URL a moment
 * later. Two browser gotchas handled here:
 *
 * 1. Revoking the URL (or removing the anchor) immediately after click() can
 *    cancel the transfer before it starts — Safari especially saves a corrupt
 *    or empty file. We keep the anchor in the DOM and only clean up after a
 *    short delay.
 * 2. If the server answered with an error body instead of the file (expired
 *    session, not found, ...), the user would silently get a broken file.
 *    We sniff the first bytes against the expected format and surface a clear
 *    message instead.
 */
export const downloadBlob = async (blob: Blob, filename: string) => {
  const expected = expectedFileKind(filename);
  if (expected) {
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    const headText = String.fromCharCode(...head);
    if (!headText.startsWith(expected.signature)) {
      const snippet = (await blob.slice(0, 160).text()).replace(/\s+/g, " ").trim();
      console.warn("Download content check failed for", filename, "— got:", snippet);
      toast.error(
        `The server didn't send a ${expected.label} — it returned an error or your session expired. Please refresh and try again.`,
      );
      return;
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  // Keep the anchor alive and the URL valid until the browser has had a
  // chance to start the transfer — then clean up.
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
};

const expectedFileKind = (filename: string): { label: string; signature: string } | null => {
  if (filename.toLowerCase().endsWith(".pdf")) return { label: "PDF", signature: "%PDF" };
  if (filename.toLowerCase().endsWith(".png")) return { label: "image", signature: "\u0089PNG" };
  if (filename.toLowerCase().endsWith(".json")) return { label: "data file", signature: "{" };
  return null;
};