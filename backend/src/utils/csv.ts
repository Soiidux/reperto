// Minimal CSV writer, no dependencies. Every cell is quoted and escaped so
// commas, quotes and newlines in patient-provided text can't break the file.
// Spreadsheet-injection guard: cells starting with = + - @ get a leading
// apostrophe so Excel/Sheets treats them as text, never as a formula.

const INJECTION_START = /^[=+\-@]/;

export const toCsv = (rows: (string | number | null | undefined)[][]): string =>
  rows
    .map((row) =>
      row
        .map((cell) => {
          let value = String(cell ?? "");
          if (INJECTION_START.test(value.trim())) value = `'${value}`;
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");