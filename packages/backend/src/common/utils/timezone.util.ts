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
