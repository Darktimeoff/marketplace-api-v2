import type { OrderStatusType } from '../type/order-status.type.js';

export interface OrderStatusUpdateRequestInterface {
  userId: number;
  status: OrderStatusType;
}
