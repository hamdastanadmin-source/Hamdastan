/**
 * Calendar days in a named zone, worked out with `Intl` alone — so a zone
 * with daylight saving still gets its own midnight. Used by the journey
 * clock in `apps/api` and by the journey schema, which derives a campaign's
 * end from its start.
 */

/** The wall-clock date and time of `instant` in `timeZone`. */
function wallClock(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour'), minute: part('minute'), second: part('second') };
}

/** How far `timeZone` is ahead of UTC at `instant`, in milliseconds. */
function zoneOffset(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Midnight in `timeZone` of the day `days` after the one `instant` falls on there. */
export function zonedMidnight(instant: Date, timeZone: string, days = 0): Date {
  const w = wallClock(instant, timeZone);
  const wall = Date.UTC(w.year, w.month - 1, w.day + days);
  // Twice: the first guess may sit across a daylight-saving change from the answer.
  const guess = wall - zoneOffset(new Date(wall), timeZone);
  return new Date(wall - zoneOffset(new Date(guess), timeZone));
}

/** Whether `timeZone` is an IANA zone this runtime knows. */
export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}
