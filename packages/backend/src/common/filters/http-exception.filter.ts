import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || 'unknown';

    let status: number;
    let message: string | object;
    let details: unknown;
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || HttpStatus[status];
        // main.ts builds { message: 'Validation failed', details: [...] } with
        // one entry per failing field, and this filter used to read only the
        // message — so every validation failure in the product arrived as a
        // bare "Validation failed" with no indication of which field or why.
        // A user saw a form refuse to save and had nothing to act on; so did
        // whoever was debugging it. The details are the caller's own input
        // echoed back with the constraint it broke, so there is nothing here
        // to withhold.
        details = (exceptionResponse as any).details;
      } else {
        message = exceptionResponse;
        error = HttpStatus[status] || 'Error';
      }
    } else if (this.isEntityNotFound(exception)) {
      // TypeORM's findOneOrFail throws EntityNotFoundError when the row is
      // simply absent. That is a 404 — the caller asked for something that is
      // not there — and it was surfacing as 500 "An unexpected error occurred",
      // which reads like the server broke. Found on
      // GET /suppliers/:id/scorecard while sweeping every parameterised GET
      // with an id that does not exist.
      status = HttpStatus.NOT_FOUND;
      message = 'The requested record was not found';
      error = 'NOT_FOUND';
      this.logger.warn(
        `Entity not found: ${(exception as Error).message.split('\n')[0]}`,
        `${request.method} ${request.url}`,
      );
    } else if (this.isInvalidInputSyntax(exception)) {
      // Postgres 22P02 — "invalid input syntax for type uuid/integer/date".
      // The client sent something the column type cannot hold, which is a bad
      // request, not a server fault. 142 of the 200 list endpoints that take an
      // id-shaped query parameter answered a malformed one with a 500: the
      // caller saw "An unexpected error occurred" and every such probe landed
      // in the logs looking like a crash, which is how a real crash goes
      // unnoticed.
      //
      // Still logged at error level with the driver's own message: if one of
      // these ever comes from a query the SERVER built badly rather than from
      // user input, the evidence has to stay visible.
      status = HttpStatus.BAD_REQUEST;
      message = 'One of the values supplied is not in a valid format';
      error = 'BAD_REQUEST';
      this.logger.error(
        `Invalid input syntax: ${(exception as Error).message}`,
        undefined,
        `${request.method} ${request.url}`,
      );
    } else if (this.isHttpError(exception)) {
      // Errors from express middleware (body-parser, raw-body) carry a
      // proper 4xx status — e.g. PayloadTooLargeError (413) when a request
      // exceeds the body size limit. Surface them instead of masking as 500.
      status = (exception as any).status || (exception as any).statusCode;
      message =
        status === HttpStatus.PAYLOAD_TOO_LARGE
          ? 'The uploaded content is too large. Maximum is 10 MB for settings/facility uploads and 1 MB for other requests — try a smaller image or file.'
          : (exception as Error).message;
      error = HttpStatus[status] || 'Error';
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
      error = 'Internal Server Error';

      // Log the full error for internal debugging but don't expose to client
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : 'Unknown error'}`,
        exception instanceof Error ? exception.stack : undefined,
        `${request.method} ${request.url}`,
      );
    }

    const responseBody = {
      statusCode: status,
      error,
      message,
      // Omitted entirely rather than sent as null, so clients can test for it.
      ...(details === undefined ? {} : { details }),
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    // Don't log 401/403/404 as errors — they're expected
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} [requestId=${requestId}]`,
        JSON.stringify(responseBody),
      );
    } else if (status >= 400 && status !== 401 && status !== 403 && status !== 404) {
      this.logger.warn(
        `${request.method} ${request.url} ${status} [requestId=${requestId}]`,
        JSON.stringify(responseBody),
      );
    }

    // A streaming endpoint (the audit-log export, any download) has already
    // written its status line and headers by the time a query fails halfway
    // through. Calling status().json() on that response throws
    // ERR_HTTP_HEADERS_SENT from inside the exception filter itself — an
    // exception with nowhere left to go, which took the whole Node process
    // down and with it the API for every other user. One malformed id on
    // GET /admin/audit-logs/export was enough to do it.
    //
    // Nothing useful can be sent at this point: the client already has a 200
    // and part of a body. Cut the connection so it sees a truncated response
    // and fails, rather than trusting a half-written export.
    if (response.headersSent) {
      this.logger.error(
        `${request.method} ${request.url} failed after the response had begun; ` +
          `aborting the connection [requestId=${requestId}]`,
      );
      response.destroy();
      return;
    }

    response.status(status).json(responseBody);
  }

  /** True for express/http-errors style errors with a valid 4xx client status. */
  private isHttpError(exception: unknown): boolean {
    if (!(exception instanceof Error)) return false;
    const status = (exception as any).status || (exception as any).statusCode;
    return typeof status === 'number' && status >= 400 && status < 500;
  }

  /** TypeORM's EntityNotFoundError — findOneOrFail against a row that is not there. */
  private isEntityNotFound(exception: unknown): boolean {
    if (!(exception instanceof Error)) return false;
    return exception.name === 'EntityNotFoundError';
  }

  /**
   * A TypeORM QueryFailedError whose SQLSTATE says the VALUE was malformed:
   *   22P02 invalid_text_representation  — "invalid input syntax for type uuid"
   *   22007 invalid_datetime_format      — "invalid input syntax for type date"
   *   22008 datetime_field_overflow
   *
   * Deliberately not 22001 (string too long) or 22003 (numeric out of range):
   * those as often mean the server computed something wrong as that the client
   * sent something wrong, and mislabelling a server bug 400 would hide it.
   */
  private isInvalidInputSyntax(exception: unknown): boolean {
    if (!(exception instanceof Error)) return false;
    const driverError = (exception as any).driverError ?? exception;
    return ['22P02', '22007', '22008'].includes(driverError?.code);
  }
}
