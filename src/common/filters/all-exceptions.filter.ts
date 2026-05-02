import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  LoggerService,
} from '@nestjs/common';
import { getReasonPhrase } from 'http-status-codes';
import { Request, Response } from 'express';
import { isAppHttpError } from '../errors/app-http.error';
import { ensureRetryAfterHeader } from '../utils/retry-after.helper';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (isAppHttpError(exception)) {
      const status = exception.statusCode;
      this.logger.warn(
        `${req.method} ${req.url} -> ${status} ${exception.message}`,
        'ExceptionFilter',
      );
      ensureRetryAfterHeader(res, status);
      res.status(status).json({
        statusCode: status,
        error: getReasonPhrase(status),
        message: exception.message,
        ...(exception.extras ?? {}),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      this.logger.warn(
        `${req.method} ${req.url} -> ${status} ${
          exception.message || 'HttpException'
        }`,
        'ExceptionFilter',
      );

      ensureRetryAfterHeader(res, status);

      res
        .status(status)
        .json(
          typeof body === 'object' && body !== null
            ? body
            : { statusCode: status, message: String(body) },
        );
      return;
    }

    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `${req.method} ${req.url} unhandled: ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
      stack,
      'ExceptionFilter',
    );

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  }
}
