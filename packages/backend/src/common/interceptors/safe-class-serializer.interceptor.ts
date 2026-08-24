import { CallHandler, ExecutionContext, ClassSerializerInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * ClassSerializerInterceptor that will not try to serialise an Express
 * Response.
 *
 * Handlers holding `@Res()` write the reply themselves, and the common idiom
 * is `return res.status(404).json(...)`, which hands the Response object back
 * as the handler's return value. Twelve handlers across five controllers do
 * that — HR document download, patient photo, patient file, the SaaS revenue
 * exports, and the update package download.
 *
 * Global interceptors are registered in order and their response-path `map`
 * runs in REVERSE, so this one — registered last — is the first thing to see
 * that value. `classToPlain` then walks the Response, reaches into the socket
 * and the HTTP parser, and throws `TypeError: this.removeListener is not a
 * function`. The connection is left wedged and the process never recovers: a
 * single authenticated GET to /updates/download/:version stopped the API
 * answering anything at all, for the whole hospital. Verified — three health
 * probes after that one request returned nothing.
 *
 * Same family as the audit-log CSV export crash: something wrote to a response
 * that had already been committed. There the exception filter learned to check
 * `headersSent`; every layer that can touch a reply needs the same guard.
 */
export class SafeClassSerializerInterceptor extends ClassSerializerInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse();
    return next.handle().pipe(
      map((data) => {
        if (data === response || response?.headersSent) {
          return undefined;
        }
        return data;
      }),
      // Only now hand what is left to the real serialiser.
      (source) => super.intercept(context, { handle: () => source } as CallHandler),
    );
  }
}
