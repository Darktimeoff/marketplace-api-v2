import type { OrderStatus } from '../type/order-status.type.js';

export interface OrderStatusUpdateRequest {
  userId: number;
  status: OrderStatus;
}
