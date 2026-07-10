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
}
