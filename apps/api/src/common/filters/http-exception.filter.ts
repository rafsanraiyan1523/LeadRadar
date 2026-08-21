import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface StructuredError {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.toStructuredError(exception, request.url);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toStructuredError(exception: unknown, path: string): StructuredError {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ??
            exception.message);

      return {
        statusCode: status,
        error: HttpStatus[status] ?? 'ERROR',
        message,
        path,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      statusCode: 500,
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      path,
      timestamp: new Date().toISOString(),
    };
  }
}
