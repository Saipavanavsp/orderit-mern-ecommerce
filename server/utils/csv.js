// Minimal RFC 4180 CSV writer with spreadsheet formula-injection protection.
const UTF8_BOM = String.fromCharCode(0xfeff); // lets Excel open UTF-8 (rupee sign, accents) correctly

function cell(value) {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop Excel from evaluating formulas
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV(rows, columns) {
  const header = columns.map((c) => cell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => cell(c.value(row))).join(','));
  return `${UTF8_BOM}${[header, ...lines].join('\r\n')}\r\n`;
}
