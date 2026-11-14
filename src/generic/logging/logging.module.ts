import type { IncomingMessage, ServerResponse } from 'node:http';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

const unloggedPaths = ['/healthz', '/readyz', '/metrics'];

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
        quietReqLogger: true,
        serializers: {
          req: (request: IncomingMessage) => ({ method: request.method, path: pathOf(request) }),
          res: (response: ServerResponse) => ({ statusCode: response.statusCode }),
        },
      },
    }),
  ],
})
export class LoggingModule {}
