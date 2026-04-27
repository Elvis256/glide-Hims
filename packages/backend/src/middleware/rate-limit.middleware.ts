import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private requests: Map<string, RateLimitEntry> = new Map();
  private readonly WINDOW_SIZE = 60000; // 1 minute
  private readonly MAX_REQUESTS = 100;

  use(req: Request, res: Response, next: NextFunction) {
    const key = this.getClientIdentifier(req);
    const now = Date.now();

    let entry = this.requests.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime: now + this.WINDOW_SIZE,
      };
    } else {
      entry.count++;
    }

    this.requests.set(key, entry);

    res.setHeader('X-RateLimit-Limit', this.MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, this.MAX_REQUESTS - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

    if (entry.count > this.MAX_REQUESTS) {
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    next();
  }

  private getClientIdentifier(req: Request): string {
    const userId = (req.user as any)?.userId;
    if (userId) return `user:${userId}`;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `ip:${ip}`;
  }
}
