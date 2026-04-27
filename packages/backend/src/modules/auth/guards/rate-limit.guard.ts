import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { CacheService } from '../../cache/cache.service';

/**
 * Balanced Rate Limiting Guard for Login Endpoint
 *
 * Buckets attempts per (IP, username) so that one user behind a NAT
 * who fat-fingers their password does not lock out everyone else on
 * that public IP. Account-level lockout is handled separately in
 * AuthService (database-backed).
 *
 *   Attempts 1-3: Normal login (no delay)
 *   Attempts 4-5: Warning + 2-second delay
 *   Attempts 6+ : Block (ip, user) for 15 minutes
 *
 * In addition, an IP-wide hard ceiling protects against fan-out
 * attacks that try many usernames from a single source.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly logger = new Logger(RateLimitGuard.name);

  // Per-(ip, user) thresholds
  private readonly WARNING_THRESHOLD = 3;
  private readonly MAX_ATTEMPTS = 6;
  private readonly WINDOW_SECONDS = 15 * 60;
  private readonly BLOCK_DURATION_SECONDS = 15 * 60;
  private readonly PROGRESSIVE_DELAY_MS = 2000;

  // Per-IP hard ceiling (independent of username) to stop fan-out probing
  private readonly IP_HARD_LIMIT = 30;
  private readonly IP_HARD_BLOCK_SECONDS = 30 * 60;

  constructor(private readonly cacheService: CacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);
    const username = this.extractUsername(request);
    const userKey = this.bucketUser(username);

    const attemptKey = `ratelimit:login:${ip}:${userKey}`;
    const blockKey = `ratelimit:block:${ip}:${userKey}`;
    const ipAttemptKey = `ratelimit:ip-login:${ip}`;
    const ipBlockKey = `ratelimit:ip-block:${ip}`;

    // 1) IP-wide hard block check
    const ipBlockedUntil = await this.cacheService.get<number>(ipBlockKey);
    if (ipBlockedUntil && Date.now() < ipBlockedUntil) {
      this.throwBlocked(ipBlockedUntil, true);
    }

    // 2) Per-(ip, user) block check
    const blockedUntil = await this.cacheService.get<number>(blockKey);
    if (blockedUntil && Date.now() < blockedUntil) {
      this.throwBlocked(blockedUntil, false);
    }

    const currentAttempts = (await this.cacheService.get<number>(attemptKey)) || 0;
    const currentIpAttempts = (await this.cacheService.get<number>(ipAttemptKey)) || 0;

    // 3) Per-(ip, user) max
    if (currentAttempts >= this.MAX_ATTEMPTS) {
      const blockUntil = Date.now() + this.BLOCK_DURATION_SECONDS * 1000;
      await this.cacheService.set(blockKey, blockUntil, this.BLOCK_DURATION_SECONDS);
      RateLimitGuard.logger.warn(
        `[SECURITY] (${ip}, ${userKey}) blocked after ${currentAttempts} failed attempts`,
      );
      this.throwBlocked(blockUntil, false);
    }

    // 4) IP-wide hard ceiling
    if (currentIpAttempts >= this.IP_HARD_LIMIT) {
      const blockUntil = Date.now() + this.IP_HARD_BLOCK_SECONDS * 1000;
      await this.cacheService.set(ipBlockKey, blockUntil, this.IP_HARD_BLOCK_SECONDS);
      RateLimitGuard.logger.warn(
        `[SECURITY] IP ${ip} hit hard ceiling (${currentIpAttempts} attempts across users); blocked ${this.IP_HARD_BLOCK_SECONDS / 60}m`,
      );
      this.throwBlocked(blockUntil, true);
    }

    // 5) Warning + progressive delay
    if (currentAttempts >= this.WARNING_THRESHOLD) {
      RateLimitGuard.logger.warn(
        `[SECURITY] (${ip}, ${userKey}) approaching limit (${currentAttempts}/${this.MAX_ATTEMPTS})`,
      );
      await this.delay(this.PROGRESSIVE_DELAY_MS);
      (request as any).rateLimitWarning = {
        attemptsRemaining: this.MAX_ATTEMPTS - currentAttempts,
        message: `Warning: ${this.MAX_ATTEMPTS - currentAttempts} login attempt${
          this.MAX_ATTEMPTS - currentAttempts > 1 ? 's' : ''
        } remaining before temporary lockout.`,
      };
    }

    await this.cacheService.set(attemptKey, currentAttempts + 1, this.WINDOW_SECONDS);
    await this.cacheService.set(ipAttemptKey, currentIpAttempts + 1, this.WINDOW_SECONDS);

    return true;
  }

  /**
   * Reset attempts for an IP (and optionally a username) after successful login.
   * Called from the login controller.
   */
  async resetAttempts(ip: string, username?: string): Promise<void> {
    const userKey = this.bucketUser(username || '');
    await this.cacheService.del(`ratelimit:login:${ip}:${userKey}`);
    await this.cacheService.del(`ratelimit:block:${ip}:${userKey}`);
    // Also decay the IP-wide counter on success so legitimate use does not pile up
    await this.cacheService.del(`ratelimit:ip-login:${ip}`);
    RateLimitGuard.logger.debug(`Rate limit reset for (${ip}, ${userKey})`);
  }

  async getAttemptCount(ip: string, username?: string): Promise<number> {
    const userKey = this.bucketUser(username || '');
    return (await this.cacheService.get<number>(`ratelimit:login:${ip}:${userKey}`)) || 0;
  }

  /**
   * List currently blocked entries for admin review.
   * Returns both per-(ip, user) and IP-wide blocks.
   */
  async listBlocked(): Promise<
    Array<{ kind: 'ip' | 'user'; ip: string; username?: string; blockedUntil: string; remainingSeconds: number }>
  > {
    const out: Array<any> = [];
    const now = Date.now();
    const userBlockKeys = await this.cacheService.keys('ratelimit:block:*');
    for (const k of userBlockKeys) {
      const until = await this.cacheService.get<number>(k);
      if (!until || until < now) continue;
      // key format: ratelimit:block:<ip>:<userBucket>
      const parts = k.split(':');
      const ip = parts[2];
      const username = parts.slice(3).join(':');
      out.push({
        kind: 'user',
        ip,
        username,
        blockedUntil: new Date(until).toISOString(),
        remainingSeconds: Math.ceil((until - now) / 1000),
      });
    }
    const ipBlockKeys = await this.cacheService.keys('ratelimit:ip-block:*');
    for (const k of ipBlockKeys) {
      const until = await this.cacheService.get<number>(k);
      if (!until || until < now) continue;
      const ip = k.split(':')[2];
      out.push({
        kind: 'ip',
        ip,
        blockedUntil: new Date(until).toISOString(),
        remainingSeconds: Math.ceil((until - now) / 1000),
      });
    }
    return out;
  }

  /**
   * Manually unblock an IP (and optionally a specific username).
   * If username is omitted, clears EVERYTHING for the IP — both the IP-wide
   * block and every per-(ip, user) block.
   */
  async unblockIp(ip: string, username?: string): Promise<{ cleared: number }> {
    let cleared = 0;
    if (username) {
      const userKey = this.bucketUser(username);
      await this.cacheService.del(`ratelimit:login:${ip}:${userKey}`);
      await this.cacheService.del(`ratelimit:block:${ip}:${userKey}`);
      cleared += 2;
    } else {
      const allUserKeys = await this.cacheService.keys(`ratelimit:block:${ip}:*`);
      for (const k of allUserKeys) {
        await this.cacheService.del(k);
        cleared++;
      }
      const allAttemptKeys = await this.cacheService.keys(`ratelimit:login:${ip}:*`);
      for (const k of allAttemptKeys) {
        await this.cacheService.del(k);
        cleared++;
      }
    }
    await this.cacheService.del(`ratelimit:ip-login:${ip}`);
    await this.cacheService.del(`ratelimit:ip-block:${ip}`);
    cleared += 2;
    RateLimitGuard.logger.log(`[ADMIN] Unblock IP ${ip}${username ? ` for user ${username}` : ''} — cleared ${cleared} keys`);
    return { cleared };
  }

  private getClientIp(request: Request): string {
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  private extractUsername(request: Request): string {
    const body = (request.body || {}) as any;
    const raw = body.username || body.email || body.identifier || '';
    return typeof raw === 'string' ? raw : '';
  }

  /**
   * Normalize username for bucketing (lowercase, trimmed). Empty string for
   * requests without a username — those still get bucketed together so a
   * caller spamming the endpoint without credentials can be blocked.
   */
  private bucketUser(username: string): string {
    return (username || '').trim().toLowerCase().slice(0, 128) || '__none__';
  }

  private throwBlocked(blockedUntil: number, ipWide: boolean): never {
    const remainingSeconds = Math.ceil((blockedUntil - Date.now()) / 1000);
    const remainingMinutes = Math.ceil(remainingSeconds / 60);
    throw new HttpException(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: ipWide
          ? `Too many login attempts from this IP. Temporarily blocked for ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`
          : `Too many login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
        retryAfter: remainingSeconds,
        blockedUntil: new Date(blockedUntil).toISOString(),
        scope: ipWide ? 'ip' : 'account',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
