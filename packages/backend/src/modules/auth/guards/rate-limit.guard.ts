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
 * Security vs Productivity Balance:
 * - Attempts 1-3: Normal login (no delay)
 * - Attempts 4-5: Warning + 2-second delay
 * - Attempts 6+: Block IP for 15 minutes
 *
 * Uses CacheService for rate limit state.
 * Account-level lockout is handled separately in AuthService (database-backed).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly logger = new Logger(RateLimitGuard.name);

  // Configuration
  private readonly WARNING_THRESHOLD = 3; // Warn after 3 attempts
  private readonly MAX_ATTEMPTS = 6; // Block after 6 attempts
  private readonly WINDOW_SECONDS = 15 * 60; // 15 minute window
  private readonly BLOCK_DURATION_SECONDS = 15 * 60; // 15 minute block
  private readonly PROGRESSIVE_DELAY_MS = 2000; // 2 second delay after warning threshold

  constructor(private readonly cacheService: CacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);

    // Check if IP is currently blocked
    const blockedUntil = await this.cacheService.get<number>(`ratelimit:block:${ip}`);
    if (blockedUntil && Date.now() < blockedUntil) {
      const remainingSeconds = Math.ceil((blockedUntil - Date.now()) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many login attempts. Please try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
          retryAfter: remainingSeconds,
          blockedUntil: new Date(blockedUntil).toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Get current attempt count
    const attemptKey = `ratelimit:login:${ip}`;
    const currentAttempts = (await this.cacheService.get<number>(attemptKey)) || 0;

    // Check if max attempts exceeded
    if (currentAttempts >= this.MAX_ATTEMPTS) {
      // Block the IP
      const blockUntil = Date.now() + this.BLOCK_DURATION_SECONDS * 1000;
      await this.cacheService.set(`ratelimit:block:${ip}`, blockUntil, this.BLOCK_DURATION_SECONDS);

      RateLimitGuard.logger.warn(
        `[SECURITY] IP ${ip} blocked after ${currentAttempts} failed login attempts`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many login attempts. Your IP has been temporarily blocked for ${this.BLOCK_DURATION_SECONDS / 60} minutes.`,
          retryAfter: this.BLOCK_DURATION_SECONDS,
          blockedUntil: new Date(blockUntil).toISOString(),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Progressive delay after warning threshold
    if (currentAttempts >= this.WARNING_THRESHOLD) {
      RateLimitGuard.logger.warn(
        `[SECURITY] IP ${ip} approaching rate limit (${currentAttempts}/${this.MAX_ATTEMPTS} attempts)`,
      );

      // Add progressive delay
      await this.delay(this.PROGRESSIVE_DELAY_MS);

      // Attach warning info to request for the controller to include in response
      (request as any).rateLimitWarning = {
        attemptsRemaining: this.MAX_ATTEMPTS - currentAttempts,
        message: `Warning: ${this.MAX_ATTEMPTS - currentAttempts} login attempt${this.MAX_ATTEMPTS - currentAttempts > 1 ? 's' : ''} remaining before temporary lockout.`,
      };
    }

    // Increment attempt counter (will be reset on successful login)
    await this.cacheService.set(attemptKey, currentAttempts + 1, this.WINDOW_SECONDS);

    return true;
  }

  /**
   * Reset attempts for an IP after successful login
   */
  async resetAttempts(ip: string): Promise<void> {
    await this.cacheService.del(`ratelimit:login:${ip}`);
    await this.cacheService.del(`ratelimit:block:${ip}`);
    RateLimitGuard.logger.debug(`Rate limit reset for IP ${ip}`);
  }

  /**
   * Get current attempt count for an IP (for admin monitoring)
   */
  async getAttemptCount(ip: string): Promise<number> {
    return (await this.cacheService.get<number>(`ratelimit:login:${ip}`)) || 0;
  }

  /**
   * Manually unblock an IP (admin function)
   */
  async unblockIp(ip: string): Promise<void> {
    await this.cacheService.del(`ratelimit:login:${ip}`);
    await this.cacheService.del(`ratelimit:block:${ip}`);
    RateLimitGuard.logger.log(`[ADMIN] IP ${ip} manually unblocked`);
  }

  /**
   * Get client IP from request.
   */
  private getClientIp(request: Request): string {
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Promise-based delay for progressive slowdown
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
