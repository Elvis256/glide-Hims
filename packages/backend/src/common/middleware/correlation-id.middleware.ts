import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Express middleware (not NestJS-managed) that adds X-Request-Id to
 * every request/response for distributed tracing.
 * Applied in main.ts via app.use() before any guards/interceptors.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-request-id'] as string) || randomUUID();
  req.headers['x-request-id'] = correlationId;
  res.setHeader('X-Request-Id', correlationId);
  next();
}
