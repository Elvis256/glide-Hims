/**
 * The wall-clock timezone the hospital works in.
 *
 * Timestamps are stored as timestamptz, so they are unambiguous instants — but
 * anything that buckets them into a *day* needs the local zone, and the server
 * is not it. Postgres runs on UTC here, and Uganda is UTC+3, so asking Postgres
 * for DATE(scheduled_time) files a dose due at 01:00 on the 16th under the
 * 15th: the whole midnight-to-3am drug round disappears from the day's chart.
 *
 * Override with HOSPITAL_TIMEZONE for a deployment in another zone.
 */
const DEFAULT_TIME_ZONE = 'Africa/Kampala';

let cached: string | undefined;

export function hospitalTimeZone(): string {
  if (cached) return cached;

  const configured = (process.env.HOSPITAL_TIMEZONE || '').trim();
  if (!configured) {
    cached = DEFAULT_TIME_ZONE;
    return cached;
  }

  // Fail loudly rather than silently bucketing days in the wrong zone.
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: configured });
  } catch {
    throw new Error(
      `HOSPITAL_TIMEZONE is not a valid IANA timezone: "${configured}" (e.g. Africa/Kampala)`,
    );
  }

  cached = configured;
  return cached;
}

/** Test seam — clears the memoised value so env changes take effect. */
export function resetHospitalTimeZoneCache(): void {
  cached = undefined;
}

/** IANA zone names are letters, digits, underscore, plus, minus and slashes. */
const IANA_NAME = /^[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)*$/;

/**
 * The hospital zone, checked to be safe to embed in SQL.
 *
 * Some period boundaries are far clearer written as
 * `date_trunc('month', NOW() AT TIME ZONE z) AT TIME ZONE z` than assembled in
 * JavaScript, and a placeholder cannot be used in every position. The value is
 * config, never user input, but it is asserted to be a plain zone name so the
 * safety of embedding it does not rest on that alone.
 */
export function sqlSafeTimeZone(): string {
  const zone = hospitalTimeZone();
  if (!IANA_NAME.test(zone)) {
    throw new Error(`Refusing to use "${zone}" in SQL: not a plain IANA timezone name`);
  }
  return zone;
}

/** How far ahead of UTC `zone` is at a given instant, in milliseconds. */
function zoneOffsetMs(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);

  const at = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    at('year'),
    at('month') - 1,
    at('day'),
    // Some environments render midnight as hour 24.
    at('hour') % 24,
    at('minute'),
    at('second'),
  );
  // formatToParts resolves to whole seconds, so compare against the instant
  // truncated the same way — otherwise the milliseconds of an end-of-day
  // boundary leak into the offset and push it past midnight.
  const wholeSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return asUtc - wholeSeconds;
}

/**
 * The instant at which a wall-clock time on `dateStr` occurs in `zone`.
 *
 * `new Date('2026-08-16')` is UTC midnight by specification, and setHours()
 * then works in the *server's* zone — so a report window built that way is
 * skewed by the offset, sweeping the small hours of the next local day into
 * the range and dropping the same slice off the front.
 */
function wallClockToUtc(
  dateStr: string,
  h: number,
  m: number,
  s: number,
  ms: number,
  zone: string,
): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) {
    throw new Error(`Expected a YYYY-MM-DD date, got "${dateStr}"`);
  }
  const guess = Date.UTC(year, month - 1, day, h, m, s, ms);
  // Resolve against the offset in force at the candidate instant, then settle
  // once more so a boundary that lands inside a DST shift converges.
  const firstPass = guess - zoneOffsetMs(new Date(guess), zone);
  return new Date(guess - zoneOffsetMs(new Date(firstPass), zone));
}

/** First instant of `dateStr` as the hospital experiences it. */
export function startOfDayUtc(dateStr: string, zone: string = hospitalTimeZone()): Date {
  return wallClockToUtc(dateStr, 0, 0, 0, 0, zone);
}

/** Last instant of `dateStr` as the hospital experiences it. */
export function endOfDayUtc(dateStr: string, zone: string = hospitalTimeZone()): Date {
  return wallClockToUtc(dateStr, 23, 59, 59, 999, zone);
}

/** The calendar date an instant falls on where the hospital is, as YYYY-MM-DD. */
export function localDateString(instant: Date, zone: string = hospitalTimeZone()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const at = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${at('year')}-${at('month')}-${at('day')}`;
}

/**
 * The instants bounding the hospital's day containing `value`.
 *
 * Accepts a bare YYYY-MM-DD (already a calendar date, used as-is) or an
 * instant, whose *local* date is taken. Passing an instant through as a
 * date string would use its UTC date, which after 21:00 local is tomorrow.
 */
export function dayBoundsUtc(
  value: string | Date,
  zone: string = hospitalTimeZone(),
): { start: Date; end: Date } {
  let dateStr: string;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    dateStr = value;
  } else {
    const instant = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(instant.getTime())) {
      throw new Error(`Not a usable date: "${String(value)}"`);
    }
    dateStr = localDateString(instant, zone);
  }
  return { start: startOfDayUtc(dateStr, zone), end: endOfDayUtc(dateStr, zone) };
}

/**
 * Start of the hospital's day, `offsetDays` from today.
 *
 * Deliberately calendar arithmetic rather than adding 24-hour blocks to an
 * instant: a day is not always 24 hours long once a zone observes daylight
 * saving, and "tomorrow's appointments" must mean the next calendar day
 * whatever the clocks did overnight.
 */
export function localDayStart(offsetDays = 0, zone: string = hospitalTimeZone()): Date {
  const [y, m, d] = localDateString(new Date(), zone).split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return startOfDayUtc(shifted.toISOString().slice(0, 10), zone);
}

/** The calendar month an instant falls in where the hospital is, as YYYY-MM. */
export function localMonthString(instant: Date, zone: string = hospitalTimeZone()): string {
  return localDateString(instant, zone).slice(0, 7);
}

/**
 * The instants bounding the hospital's month, `offsetMonths` from the current
 * one (0 = this month, -1 = last month).
 *
 * Monthly spend and trend reports were assembling boundaries with
 * `new Date(year, month, 1)`, which is midnight in the *server's* zone. On a
 * UTC server that is 03:00 in Kampala, so the first three hours of every month
 * were reported under the month before — and the same slice of the following
 * month was counted twice over at the other end.
 */
export function monthBoundsUtc(
  offsetMonths = 0,
  zone: string = hospitalTimeZone(),
): { start: Date; end: Date; period: string } {
  const [y, m] = localMonthString(new Date(), zone).split('-').map(Number);

  // Normalise through UTC calendar arithmetic so month overflow/underflow
  // (December + 1, January - 1) is handled for us, then convert the resulting
  // wall-clock dates into instants in the hospital's zone.
  const startCal = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  const nextCal = new Date(Date.UTC(y, m + offsetMonths, 1));

  const startStr = startCal.toISOString().slice(0, 10);
  const start = startOfDayUtc(startStr, zone);

  // End is the last instant before the next month begins, rather than the
  // 23:59:59.999 of a day computed by subtracting 24 hours — which would be
  // the wrong day in a zone that moved its clocks that month.
  const end = new Date(startOfDayUtc(nextCal.toISOString().slice(0, 10), zone).getTime() - 1);

  return { start, end, period: startStr.slice(0, 7) };
}

/** A given hour of `dateStr` in the hospital's zone — used for census snapshots. */
export function hourOfDayUtc(
  dateStr: string,
  hour: number,
  zone: string = hospitalTimeZone(),
): Date {
  return wallClockToUtc(dateStr, hour, 0, 0, 0, zone);
}
