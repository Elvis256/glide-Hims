import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark an endpoint as public (no authentication required)
 * Use this decorator on endpoints that should be accessible without login
 * Example: @Public() on login, health check, etc.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
