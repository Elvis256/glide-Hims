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
export class ResponseTransformInterceptor<T> implements NestInterceptor<T, StandardResponse<T>> {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<StandardResponse<T>> {
    const skipTransform = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipTransform) {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        // A handler holding @Res() writes the reply itself, and the idiom for
        // that is `return res.status(404).json(...)` — which hands the Express
        // Response BACK as the handler's value. Wrapping it put the Response
        // object in `data`, and serialising that walks the socket and parser
        // internals: "TypeError: this.removeListener is not a function". The
        // connection is left wedged, and it does not recover — a single
        // authenticated GET to /updates/download/:version stopped the API
        // answering anything at all, for every user of the hospital. Twelve
        // handlers across five controllers use that idiom.
        //
        // If the reply is already committed, or the value IS the reply, there
        // is nothing left to wrap and nothing safe to serialise.
        if (response.headersSent || data === response) {
          return undefined as unknown as StandardResponse<T>;
        }

        // If the response already has our envelope shape, pass through
        if (data && typeof data === 'object' && 'statusCode' in data && 'data' in data) {
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
