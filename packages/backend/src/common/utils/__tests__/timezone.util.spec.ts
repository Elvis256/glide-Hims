import { hospitalTimeZone, resetHospitalTimeZoneCache } from '../timezone.util';

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
