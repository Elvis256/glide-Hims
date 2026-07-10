/**
 * Shape of the JWT payload attached to `request.user` by Passport.
 * Centralised here so controllers/services can import a single type
 * instead of defining ad-hoc interfaces or using `as any`.
 */
export interface JwtUser {
  id: string;
  sub: string;
  username?: string;
  email?: string;
  tenantId?: string;
  facilityId?: string;
  roles: string[];
  permissions?: string[];
  isSystemAdmin: boolean;
}
