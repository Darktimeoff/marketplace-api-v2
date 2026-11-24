import type { ClsStore } from 'nestjs-cls';

export interface RequestContextInterface extends ClsStore {
  userId?: string;
  idempotencyKey?: string;
}
