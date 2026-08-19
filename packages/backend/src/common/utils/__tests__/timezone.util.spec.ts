import {
  hospitalTimeZone,
  resetHospitalTimeZoneCache,
  startOfDayUtc,
  endOfDayUtc,
  hourOfDayUtc,
  localDayStart,
  dayBoundsUtc,
  localDateString,
  localMonthString,
  monthBoundsUtc,
} from '../timezone.util';

describe('hospitalTimeZone', () => {
  const original = process.env.HOSPITAL_TIMEZONE;

  beforeEach(() => {
    resetHospitalTimeZoneCache();
    delete process.env.HOSPITAL_TIMEZONE;
  });

  afterAll(() => {
    resetHospitalTimeZoneCache();
    if (original === undefined) delete process.env.HOSPITAL_TIMEZONE;
    else process.env.HOSPITAL_TIMEZONE = original;
  });

  it('defaults to Kampala, since the server clock runs on UTC', () => {
    expect(hospitalTimeZone()).toBe('Africa/Kampala');
  });

  it('honours an explicit deployment timezone', () => {
    process.env.HOSPITAL_TIMEZONE = 'Africa/Nairobi';
    expect(hospitalTimeZone()).toBe('Africa/Nairobi');
  });

  it('rejects a timezone that is not a real IANA zone', () => {
    // Silently falling back would bucket every day in the wrong zone.
    process.env.HOSPITAL_TIMEZONE = 'Kampala/Uganda';
    expect(() => hospitalTimeZone()).toThrow(/not a valid IANA timezone/);
  });

  it('ignores an empty setting rather than treating it as a zone', () => {
    process.env.HOSPITAL_TIMEZONE = '   ';
    expect(hospitalTimeZone()).toBe('Africa/Kampala');
  });
});

describe('day boundaries in the hospital zone', () => {
  beforeEach(() => {
    resetHospitalTimeZoneCache();
    delete process.env.HOSPITAL_TIMEZONE;
  });

  it('starts the Kampala day three hours before UTC midnight', () => {
    // 00:00 on the 16th in Kampala is 21:00 on the 15th in UTC.
    expect(startOfDayUtc('2026-08-16').toISOString()).toBe('2026-08-15T21:00:00.000Z');
  });

  it('ends the Kampala day before UTC midnight, not after it', () => {
    expect(endOfDayUtc('2026-08-16').toISOString()).toBe('2026-08-16T20:59:59.999Z');
  });

  it('places the midday census at midday locally', () => {
    expect(hourOfDayUtc('2026-08-16', 12).toISOString()).toBe('2026-08-16T09:00:00.000Z');
  });

  it('spans exactly one day', () => {
    const span = endOfDayUtc('2026-08-16').getTime() - startOfDayUtc('2026-08-16').getTime();
    expect(span).toBe(24 * 60 * 60 * 1000 - 1);
  });

  it('handles a zone that observes daylight saving', () => {
    // 2026-03-29 is the spring-forward day in the EU; the day is 23h long.
    const span =
      endOfDayUtc('2026-03-29', 'Europe/London').getTime() -
      startOfDayUtc('2026-03-29', 'Europe/London').getTime();
    expect(span).toBe(23 * 60 * 60 * 1000 - 1);
  });

  it('rejects a malformed date rather than silently returning an epoch', () => {
    expect(() => startOfDayUtc('16/08/2026')).toThrow(/YYYY-MM-DD/);
  });
});

describe('dayBoundsUtc', () => {
  beforeEach(() => {
    resetHospitalTimeZoneCache();
    delete process.env.HOSPITAL_TIMEZONE;
  });

  it('takes a bare date at face value', () => {
    const { start, end } = dayBoundsUtc('2026-08-16');
    expect(start.toISOString()).toBe('2026-08-15T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-16T20:59:59.999Z');
  });

  it("uses an instant's local date, not its UTC date", () => {
    // 22:30 UTC on the 16th is already 01:30 on the 17th in Kampala, so this
    // payment belongs to the 17th's takings.
    const { start, end } = dayBoundsUtc(new Date('2026-08-16T22:30:00Z'));
    expect(localDateString(new Date('2026-08-16T22:30:00Z'))).toBe('2026-08-17');
    expect(start.toISOString()).toBe('2026-08-16T21:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-17T20:59:59.999Z');
  });

  it('brackets an instant it was derived from', () => {
    const paidAt = new Date('2026-08-16T05:00:00Z'); // 08:00 in Kampala
    const { start, end } = dayBoundsUtc(paidAt);
    expect(paidAt >= start && paidAt <= end).toBe(true);
  });

  it('keeps takings from the first hours of the local day inside that day', () => {
    // 00:30 on the 16th in Kampala — the case a UTC-midnight window drops.
    const paidAt = new Date('2026-08-15T21:30:00Z');
    const { start, end } = dayBoundsUtc('2026-08-16');
    expect(paidAt >= start && paidAt <= end).toBe(true);
  });

  it('refuses an unusable value instead of bracketing the epoch', () => {
    expect(() => dayBoundsUtc('not-a-date')).toThrow(/Not a usable date/);
  });
});

describe('localDayStart', () => {
  beforeEach(() => {
    resetHospitalTimeZoneCache();
    delete process.env.HOSPITAL_TIMEZONE;
  });

  it('walks whole calendar days, not 24-hour blocks', () => {
    // Adding 24h to an instant is the same thing only while no zone the
    // deployment runs in observes daylight saving. Calendar arithmetic holds
    // either way, which is what "tomorrow's appointments" has to mean.
    const today = localDayStart(0);
    const tomorrow = localDayStart(1);
    const dayAfter = localDayStart(2);

    expect(tomorrow.getTime()).toBeGreaterThan(today.getTime());
    expect(dayAfter.getTime()).toBeGreaterThan(tomorrow.getTime());
  });

  it('lands on midnight where the hospital is', () => {
    // Kampala is UTC+3, so a local midnight is 21:00 UTC the day before.
    expect(localDayStart(0).toISOString()).toMatch(/T21:00:00\.000Z$/);
  });

  it('crosses a daylight-saving boundary without drifting off midnight', () => {
    // London springs forward on 2026-03-29; the day before is 23 hours long.
    const before = startOfDayUtc('2026-03-28', 'Europe/London');
    const after = startOfDayUtc('2026-03-29', 'Europe/London');
    expect(after.getTime() - before.getTime()).toBe(24 * 60 * 60 * 1000);
    const next = startOfDayUtc('2026-03-30', 'Europe/London');
    expect(next.getTime() - after.getTime()).toBe(23 * 60 * 60 * 1000);
  });
});

describe('monthBoundsUtc / localMonthString', () => {
  const KLA = 'Africa/Kampala'; // UTC+3, no DST

  it('starts the month at local midnight, not UTC midnight', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T09:00:00Z'));
    const { start, period } = monthBoundsUtc(0, KLA);
    expect(period).toBe('2026-08');
    // 1 Aug 00:00 in Kampala is 31 Jul 21:00 UTC
    expect(start.toISOString()).toBe('2026-07-31T21:00:00.000Z');
    jest.useRealTimers();
  });

  it('ends the instant before the next local month begins', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T09:00:00Z'));
    const { end } = monthBoundsUtc(0, KLA);
    // 1 Sep 00:00 Kampala is 31 Aug 21:00 UTC; the month ends 1ms before
    expect(end.toISOString()).toBe('2026-08-31T20:59:59.999Z');
    jest.useRealTimers();
  });

  it('claims the small hours that UTC bucketing gave to the month before', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T09:00:00Z'));
    const { start, end } = monthBoundsUtc(0, KLA);
    // A PO raised 01:30 Kampala on 1 August = 22:30 UTC on 31 July.
    const overnightOrder = new Date('2026-07-31T22:30:00Z');
    expect(overnightOrder >= start && overnightOrder <= end).toBe(true);
    jest.useRealTimers();
  });

  it('does not swallow the next month s small hours', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T09:00:00Z'));
    const { end } = monthBoundsUtc(0, KLA);
    // 01:30 Kampala on 1 September = 22:30 UTC on 31 August — September's.
    expect(new Date('2026-08-31T22:30:00Z') > end).toBe(true);
    jest.useRealTimers();
  });

  it('walks backwards across a year boundary', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-15T09:00:00Z'));
    expect(monthBoundsUtc(-1, KLA).period).toBe('2025-12');
    expect(monthBoundsUtc(-13, KLA).period).toBe('2024-12');
    jest.useRealTimers();
  });

  it('reports the local month, which after 21:00 UTC is already tomorrow s', () => {
    // 31 Aug 21:30 UTC is 1 Sep 00:30 in Kampala
    expect(localMonthString(new Date('2026-08-31T21:30:00Z'), KLA)).toBe('2026-09');
    expect(localMonthString(new Date('2026-08-31T20:30:00Z'), KLA)).toBe('2026-08');
  });
});
