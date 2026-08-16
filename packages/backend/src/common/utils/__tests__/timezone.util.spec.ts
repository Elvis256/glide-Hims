import {
  hospitalTimeZone,
  resetHospitalTimeZoneCache,
  startOfDayUtc,
  endOfDayUtc,
  hourOfDayUtc,
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
