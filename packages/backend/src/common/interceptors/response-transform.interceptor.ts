import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';

export const SKIP_TRANSFORM_KEY = 'skipTransform';
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);

export interface StandardResponse<T> {
  statusCode: number;
  data: T;
  meta?: Record<string, any>;
  timestamp: string;
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const skipTransform = this.reflector.getAllAndOverride<boolean>(
      SKIP_TRANSFORM_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipTransform) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        // If the response already has our envelope shape, pass through
        if (
          data &&
          typeof data === 'object' &&
          'statusCode' in data &&
          'data' in data
        ) {
          return data;
        }

        // If the service returned { data, total/meta/pagination }, unwrap it
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          ('total' in data || 'meta' in data || 'pagination' in data)
        ) {
          const { data: innerData, meta: existingMeta, ...rest } = data;
          return {
            statusCode: response.statusCode,
            data: innerData,
            meta: existingMeta || rest,
            timestamp: new Date().toISOString(),
          };
        }

        // Wrap plain responses
        return {
          statusCode: response.statusCode,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
