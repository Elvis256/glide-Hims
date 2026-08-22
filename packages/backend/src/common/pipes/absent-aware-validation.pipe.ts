import { ArgumentMetadata, Injectable, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';

/**
 * A ValidationPipe that leaves an absent query parameter absent.
 *
 * With `transform: true` and `enableImplicitConversion`, Nest coerces each
 * query parameter to its declared type — including the ones that were never
 * sent. For `@Query('limit') limit?: number` that means `Number(undefined)`,
 * which is `NaN`: not undefined, so the handler's default value never applies,
 * and the NaN travels all the way into the query builder, where TypeORM throws
 *
 *     Provided "take" value is not a number. Please provide a numeric value.
 *
 * — a 500 for a request whose only sin was to leave an optional parameter out.
 * `GET /stores/items` and `GET /stores/transfers/list` answered 500 always and
 * 200 the moment `?limit=10` was added; 53 optional numeric query parameters
 * across the API had the same shape.
 *
 * Fixing it here rather than at each call site: "a value that was not sent is
 * undefined" is a property of the whole API, not of any one handler. Values
 * that ARE present go through the standard pipe untouched, and bodies are left
 * alone entirely so that a missing required body still fails validation.
 */
@Injectable()
export class AbsentAwareValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super(options);
  }

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    if (value === undefined && (metadata.type === 'query' || metadata.type === 'param')) {
      return undefined;
    }
    return super.transform(value, metadata);
  }
}
