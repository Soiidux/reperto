// Text/data downloads (CSV etc.) — there are no PDF downloads in the app.
// Build the object URL and trigger the click immediately so browsers don't
// treat the navigation as a page change, then clean up.
export const downloadTextFile = (
  filename: string,
  content: string,
  mime = "text/csv;charset=utf-8",
): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};