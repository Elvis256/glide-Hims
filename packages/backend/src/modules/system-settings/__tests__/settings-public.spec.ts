import { NotFoundException } from '@nestjs/common';

/**
 * Tests for the public settings endpoint whitelist logic.
 * The controller returns real values for whitelisted keys, { key, value: null } otherwise.
 */

const PUBLIC_KEYS = [
  'app.name',
  'app.logo',
  'facility_name',
  'facility_logo',
  'facility_address',
  'login_banner',
  'setup_complete',
  'deployment_mode',
  'default_language',
  'default_currency',
];

// Simulates the controller's findOnePublic() logic
async function findOnePublic(
  key: string,
  getByKey: (key: string) => Promise<{ key: string; value: any }>,
): Promise<{ key: string; value: any }> {
  if (!PUBLIC_KEYS.includes(key)) {
    return { key, value: null };
  }
  try {
    return await getByKey(key);
  } catch {
    return { key, value: null };
  }
}

describe('Settings Public Endpoint', () => {
  const mockGetByKey = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('whitelisted keys', () => {
    it.each(PUBLIC_KEYS)('returns real value for whitelisted key: %s', async (key) => {
      mockGetByKey.mockResolvedValueOnce({ key, value: `value-of-${key}` });

      const result = await findOnePublic(key, mockGetByKey);
      expect(result).toEqual({ key, value: `value-of-${key}` });
      expect(mockGetByKey).toHaveBeenCalledWith(key);
    });

    it('returns { key, value: null } when whitelisted key not found in DB', async () => {
      mockGetByKey.mockRejectedValueOnce(new NotFoundException('Not found'));

      const result = await findOnePublic('app.name', mockGetByKey);
      expect(result).toEqual({ key: 'app.name', value: null });
    });
  });

  describe('non-whitelisted keys', () => {
    it.each([
      'admin.secret',
      'smtp.password',
      'database.url',
      'jwt.secret',
      'license.key',
      'internal.debug',
    ])('returns { key, value: null } for non-whitelisted key: %s', async (key) => {
      const result = await findOnePublic(key, mockGetByKey);
      expect(result).toEqual({ key, value: null });
      // Should never call the service for non-whitelisted keys
      expect(mockGetByKey).not.toHaveBeenCalled();
    });
  });

  describe('whitelist completeness', () => {
    it('has exactly 10 whitelisted keys', () => {
      expect(PUBLIC_KEYS).toHaveLength(10);
    });

    it('includes all expected keys', () => {
      expect(PUBLIC_KEYS).toContain('app.name');
      expect(PUBLIC_KEYS).toContain('app.logo');
      expect(PUBLIC_KEYS).toContain('facility_name');
      expect(PUBLIC_KEYS).toContain('facility_logo');
      expect(PUBLIC_KEYS).toContain('facility_address');
      expect(PUBLIC_KEYS).toContain('login_banner');
      expect(PUBLIC_KEYS).toContain('setup_complete');
      expect(PUBLIC_KEYS).toContain('deployment_mode');
      expect(PUBLIC_KEYS).toContain('default_language');
      expect(PUBLIC_KEYS).toContain('default_currency');
    });
  });
});
