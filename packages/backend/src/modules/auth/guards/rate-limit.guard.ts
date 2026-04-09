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
 * Rate Limiting Guard for Login Endpoint
 * Prevents brute force attacks by limiting login attempts
 * 
 * Uses CacheService (shared across instances) instead of in-memory Map
 * so rate limits persist across restarts and work in load-balanced deployments.
 * 
 * Rules:
 * - Max 5 attempts per 15 minutes per IP
 * - After 5 failed attempts, block for 15 minutes
 * - Successful login resets the counter
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static readonly logger = new Logger(RateLimitGuard.name);
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_SECONDS = 15 * 60; // 15 minutes
  private readonly BLOCK_DURATION_SECONDS = 15 * 60; // 15 minutes

  constructor(private readonly cacheService: CacheService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);

    // Check if IP is currently blocked
    const blockedUntil = await this.cacheService.get<number>(`ratelimit:block:${ip}`);
    if (blockedUntil && Date.now() < blockedUntil) {
      const remainingSeconds = Math.ceil((blockedUntil - Date.now()) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many login attempts. Please try again in ${remainingSeconds} seconds.`,
          retryAfter: remainingSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const result = await this.cacheService.checkRateLimit(
      `login:${ip}`,
      this.MAX_ATTEMPTS,
      this.WINDOW_SECONDS,
    );

    if (!result.allowed) {
      // Block the IP
      await this.cacheService.set(
        `ratelimit:block:${ip}`,
        Date.now() + this.BLOCK_DURATION_SECONDS * 1000,
        this.BLOCK_DURATION_SECONDS,
      );

      RateLimitGuard.logger.warn(`[SECURITY] IP ${ip} blocked due to too many login attempts`);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many login attempts. Please try again in ${this.BLOCK_DURATION_SECONDS / 60} minutes.`,
          retryAfter: this.BLOCK_DURATION_SECONDS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * Reset attempts for an IP after successful login
   */
  async resetAttempts(ip: string): Promise<void> {
    await this.cacheService.del(`ratelimit:login:${ip}`);
    await this.cacheService.del(`ratelimit:block:${ip}`);
  }

  /**
   * Get client IP from request.
   * Only trust x-forwarded-for when Express trust proxy is configured;
   * otherwise use the direct socket address to prevent IP spoofing.
   */
  private getClientIp(request: Request): string {
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }
}
