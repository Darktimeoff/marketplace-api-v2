import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const IdempotencyKey = createParamDecorator((_: unknown, context: ExecutionContext): string | undefined => {
  const value = context.switchToHttp().getRequest<Request>().headers['idempotency-key'];
  return Array.isArray(value) ? value[0] : value;
});
