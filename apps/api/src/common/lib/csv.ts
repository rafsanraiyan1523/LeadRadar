export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

/** RFC 4180 field escaping — quotes a field only when it contains a comma, quote, or newline, doubling any internal quotes. */
function escapeCsvField(
  value: string | number | boolean | null | undefined,
): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Builds a well-formed CSV document (CRLF line endings per RFC 4180) from typed rows and an explicit column list — never dumps raw object fields, so a caller can't accidentally export a column it didn't mean to. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => escapeCsvField(c.header)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCsvField(c.value(row))).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
