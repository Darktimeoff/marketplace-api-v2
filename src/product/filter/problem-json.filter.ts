import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch(HttpException)
export class ProblemJsonFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    response
      .status(status)
      .type('application/problem+json')
      .json({
        data: null,
        error: {
          type: 'about:blank',
          title: exception.name,
          status,
          detail: exception.message,
          instance: request.originalUrl,
        },
      });
  }
}
