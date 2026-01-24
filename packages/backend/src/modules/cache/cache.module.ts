import { Module, Global, DynamicModule } from '@nestjs/common';
import { CacheService } from './cache.service';

export interface CacheModuleOptions {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: number;
}

@Global()
@Module({})
export class CacheModule {
  static forRoot(options?: Partial<CacheModuleOptions>): DynamicModule {
    const defaultOptions: CacheModuleOptions = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      keyPrefix: 'glide-hims:',
      ttl: 3600,
    };

    const mergedOptions = { ...defaultOptions, ...options };

    return {
      module: CacheModule,
      providers: [
        {
          provide: 'CACHE_OPTIONS',
          useValue: mergedOptions,
        },
        CacheService,
      ],
      exports: [CacheService],
    };
  }
}
