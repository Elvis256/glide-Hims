import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * The facility this request is about, or a 400 saying it is missing.
 *
 * 34 handlers declared `@Query('facilityId') facilityId: string` — not optional,
 * because the code genuinely needs it — and Nest does not enforce a query
 * parameter's presence, so it arrived `undefined` and the service quietly
 * dropped the filter. A facility-scoped read then answered across the whole
 * tenant, which for a group with several hospitals is one site reading
 * another's suppliers, contracts, petty cash and price agreements. Nothing
 * failed; the page just showed more than it should.
 *
 * The obvious fix — reject when the query parameter is absent — would have
 * broken working screens, because the browser has been sending the facility all
 * along in the `x-facility-id` header (see the frontend api client) and these
 * handlers only ever looked at the query string. So resolve, in order:
 *
 *   1. `req.user.facilityId` — from the JWT, the only source the client cannot
 *      choose, and the same first choice FacilityGuard.extractFacilityId makes.
 *   2. the `facilityId` query parameter — already accepted from any caller
 *      today, so trusting it here grants nothing new.
 *   3. the `x-facility-id` header — what the browser actually sends.
 *
 * and 400 only when none of the three is present. That is no more permissive
 * than the behaviour it replaces: every path is still inside the caller's
 * tenant, enforced by the tenant context and RLS.
 *
 * Use `@FacilityId({ optional: true })` where answering tenant-wide really is
 * the intent — say so explicitly rather than by leaving the value undefined.
 */
export const FacilityId = createParamDecorator(
  (opts: { optional?: boolean } | undefined, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest();
    const resolved =
      req.user?.facilityId ||
      req.query?.facilityId ||
      req.headers?.['x-facility-id'] ||
      undefined;

    const value = typeof resolved === 'string' && resolved.trim() ? resolved.trim() : undefined;
    if (!value && !opts?.optional) {
      throw new BadRequestException(
        'facilityId is required — send it as a query parameter or the x-facility-id header.',
      );
    }
    return value;
  },
);
