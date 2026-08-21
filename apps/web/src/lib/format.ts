const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["week", 604_800_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

/** "3 days ago" / "in 2 hours" — used for last-activity and next-follow-up timestamps on lead cards. */
export function formatRelativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);

  if (abs < 60_000) return diff < 0 ? "just now" : "in a moment";

  for (const [unit, ms] of UNITS) {
    if (abs >= ms || unit === "minute") {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return rtf.format(Math.round(diff / 60_000), "minute");
}

export function isOverdue(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}
