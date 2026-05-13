import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../database/entities/user.entity';
import { CacheService } from '../../cache/cache.service';
import { Request } from 'express';

export interface JwtPayload {
  sub: string; // user id
  username: string;
  email: string;
  tenantId?: string;
  roles: string[];
  facilityId?: string;
  tokenVersion?: number;
  // Tenant impersonation (system admins only)
  impersonating?: boolean;
  originalTenantId?: string | null;
  impersonationGrantId?: string;
}

function extractJwtFromCookie(req: Request): string | null {
  return req?.cookies?.accessToken || null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private cacheService: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        extractJwtFromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    // Cache user status/tokenVersion for 5s to avoid DB hit on every request
    const cacheKey = `jwt:user:${payload.sub}`;
    const user = await this.cacheService.getOrSet(
      cacheKey,
      () =>
        this.userRepository.findOne({
          where: { id: payload.sub },
          select: ['id', 'tokenVersion', 'status', 'isSystemAdmin'],
        }),
      5,
    );

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      // Invalidate cache in case of stale data
      await this.cacheService.del(cacheKey);
      throw new UnauthorizedException('Token has been revoked');
    }

    return {
      sub: payload.sub, // Keep sub for backward compatibility
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      tenantId: payload.tenantId,
      roles: payload.roles,
      facilityId: payload.facilityId,
      isSystemAdmin: user.isSystemAdmin || false,
      impersonating: payload.impersonating || false,
      originalTenantId: payload.originalTenantId ?? null,
      impersonationGrantId: payload.impersonationGrantId,
    };
  }
}
