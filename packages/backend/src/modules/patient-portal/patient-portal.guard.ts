import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PatientTokenPayload } from './patient-portal.service';

/**
 * Validates JWTs issued by PatientPortalService.verifyOtp.
 * These tokens carry `kind: 'patient'` so they cannot be confused with
 * staff JWTs (which have `kind` undefined and a `roles` claim).
 */
@Injectable()
export class PatientPortalGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    // F-04: prefer the httpOnly cookie; fall back to Bearer for API clients.
    const cookieToken = req.cookies?.portalToken as string | undefined;
    const auth = (req.headers.authorization as string) || '';
    const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    const token = cookieToken || bearer;
    if (!token) throw new UnauthorizedException('Patient access token required');

    let payload: PatientTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<PatientTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired patient token');
    }
    if (payload.kind !== 'patient' || !payload.sub) {
      throw new UnauthorizedException('Not a patient portal token');
    }
    req.patientId = payload.sub;
    req.tenantId = payload.tenantId;
    return true;
  }
}
