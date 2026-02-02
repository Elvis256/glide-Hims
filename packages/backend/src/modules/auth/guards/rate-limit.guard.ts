import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';

interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

/**
 * Rate Limiting Guard for Login Endpoint
 * Prevents brute force attacks by limiting login attempts
 * 
 * Rules:
 * - Max 5 attempts per 15 minutes per IP
 * - After 5 failed attempts, block for 15 minutes
 * - Successful login resets the counter
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private static attempts: Map<string, RateLimitEntry> = new Map();
  private readonly MAX_ATTEMPTS = 5;
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes block

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);
    const now = Date.now();

    // Clean up old entries periodically
    this.cleanupOldEntries(now);

    const entry = RateLimitGuard.attempts.get(ip);

    // Check if IP is blocked
    if (entry?.blockedUntil && now < entry.blockedUntil) {
      const remainingSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many login attempts. Please try again in ${remainingSeconds} seconds.`,
          retryAfter: remainingSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check if window has expired, reset if so
    if (entry && now - entry.firstAttempt > this.WINDOW_MS) {
      RateLimitGuard.attempts.delete(ip);
    }

    // Get or create entry
    const currentEntry = RateLimitGuard.attempts.get(ip) || {
      count: 0,
      firstAttempt: now,
    };

    // Increment attempt count
    currentEntry.count++;

    // Check if max attempts exceeded
    if (currentEntry.count > this.MAX_ATTEMPTS) {
      currentEntry.blockedUntil = now + this.BLOCK_DURATION_MS;
      RateLimitGuard.attempts.set(ip, currentEntry);

      // Log the block for security monitoring
      console.warn(`[SECURITY] IP ${ip} blocked due to too many login attempts`);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Too many login attempts. Please try again in ${this.BLOCK_DURATION_MS / 1000 / 60} minutes.`,
          retryAfter: this.BLOCK_DURATION_MS / 1000,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    RateLimitGuard.attempts.set(ip, currentEntry);
    return true;
  }

  /**
   * Reset attempts for an IP after successful login
   */
  resetAttempts(ip: string): void {
    RateLimitGuard.attempts.delete(ip);
  }

  /**
   * Clear all rate limit entries (for admin use)
   */
  static clearAllAttempts(): void {
    RateLimitGuard.attempts.clear();
    console.log('[SECURITY] All rate limit entries cleared');
  }

  /**
   * Get client IP from request
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Clean up entries older than the window
   */
  private cleanupOldEntries(now: number): void {
    const maxAge = this.WINDOW_MS + this.BLOCK_DURATION_MS;
    for (const [ip, entry] of RateLimitGuard.attempts.entries()) {
      if (now - entry.firstAttempt > maxAge) {
        RateLimitGuard.attempts.delete(ip);
      }
    }
  }
}
