/**
 * Triggers a browser download for a Blob, then frees the object URL a moment
 * later. Revoking the URL immediately after click() is a classic way to lose
 * the download in some browsers (the transfer hasn't started yet, so the
 * object URL is gone before the browser asks for it). The short delay keeps
 * that from ever happening while still releasing the memory promptly.
 */
export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};