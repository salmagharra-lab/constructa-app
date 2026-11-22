// All "today" logic uses the site timezone, not the timezone of the server.
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Jerusalem";

/** Minutes to add to UTC to get local time in `tz` at instant `date`. */
export function tzOffsetMinutes(date: Date, tz = APP_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** yyyy-mm-dd of `date` in the site timezone. */
export function localDateString(date = new Date(), tz = APP_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    date,
  );
}

/** UTC instant of local midnight for a yyyy-mm-dd string. */
export function startOfLocalDay(day: string, tz = APP_TIMEZONE): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d));
  return new Date(guess.getTime() - tzOffsetMinutes(guess, tz) * 60000);
}

/** ISO instant -> value for <input type="datetime-local"> in the site timezone. */
export function toLocalInput(iso: string | null, tz = APP_TIMEZONE): string {
  if (!iso) return "";
  const date = new Date(iso);
  const local = new Date(date.getTime() + tzOffsetMinutes(date, tz) * 60000);
  return local.toISOString().slice(0, 16);
}

/** <input type="datetime-local"> value in the site timezone -> ISO instant. */
export function fromLocalInput(value: string, tz = APP_TIMEZONE): string | null {
  if (!value) return null;
  const asUtc = new Date(value + ":00Z");
  if (Number.isNaN(asUtc.getTime())) return null;
  const first = new Date(asUtc.getTime() - tzOffsetMinutes(asUtc, tz) * 60000);
  // Re-check the offset at the resulting instant (handles DST edges).
  return new Date(asUtc.getTime() - tzOffsetMinutes(first, tz) * 60000).toISOString();
}

export function formatTime(iso: string | null, locale: string, tz = APP_TIMEZONE): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );
}

export function formatDateTime(iso: string | null, locale: string, tz = APP_TIMEZONE): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone: tz,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function hoursBetween(startIso: string, endIso: string | null, now = Date.now()): number {
  const end = endIso ? new Date(endIso).getTime() : now;
  return Math.max(0, (end - new Date(startIso).getTime()) / 3_600_000);
}
