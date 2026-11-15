import type { IncomingMessage } from 'node:http';
import { ClsServiceManager, type ClsService } from 'nestjs-cls';
import type { RequestContextInterface } from './interface/request-context.interface.js';

export function setRequestContext(cls: ClsService<RequestContextInterface>, request: IncomingMessage): void {
  const idempotencyKey = request.headers['idempotency-key'];

  if (idempotencyKey) {
    cls.set('idempotencyKey', Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey);
  }
}

export function requestContextFields(): Pick<RequestContextInterface, 'userId' | 'idempotencyKey'> {
  const cls = ClsServiceManager.getClsService<RequestContextInterface>();

  if (!cls.isActive()) {
    return {};
  }

  const userId = cls.get('userId');
  const idempotencyKey = cls.get('idempotencyKey');

  return { ...(userId ? { userId } : {}), ...(idempotencyKey ? { idempotencyKey } : {}) };
}
