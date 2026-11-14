import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { trace } from '@opentelemetry/api';
import { requestContextFields } from './request-context.js';

export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  '*.headers.authorization',
  '*.headers.cookie',
  'password',
  '*.password',
  '*.*.password',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'code_verifier',
  '*.code_verifier',
  'id_token',
  '*.id_token',
];

const unloggedPaths = ['/healthz', '/readyz', '/metrics'];

function contextFields(): object {
  const traceId = trace.getActiveSpan()?.spanContext().traceId;

  return { ...(traceId ? { trace_id: traceId } : {}), ...requestContextFields() };
}

function pathOf(request: IncomingMessage): string {
  return (request.url ?? '').split('?')[0];
}

@Module({
  imports: [
    LoggerModule.forRoot({
      renameContext: 'layer',
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        autoLogging: { ignore: (request) => unloggedPaths.includes(pathOf(request)) },
        mixin: contextFields,
        redact: REDACTED_PATHS,
        serializers: {
          req: (request: IncomingMessage) => ({ method: request.method, path: pathOf(request) }),
          res: (response: ServerResponse) => ({ statusCode: response.statusCode }),
        },
      },
    }),
  ],
})
export class LoggingModule {}
