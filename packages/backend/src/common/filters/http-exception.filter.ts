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
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || HttpStatus[status];
      } else {
        message = exceptionResponse;
        error = HttpStatus[status] || 'Error';
      }
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

    response.status(status).json(responseBody);
  }

  /** True for express/http-errors style errors with a valid 4xx client status. */
  private isHttpError(exception: unknown): boolean {
    if (!(exception instanceof Error)) return false;
    const status = (exception as any).status || (exception as any).statusCode;
    return typeof status === 'number' && status >= 400 && status < 500;
  }
}
