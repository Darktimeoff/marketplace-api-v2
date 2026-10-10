import type { OrderStatusEnum } from '../enum/order-status.enum.js';

export interface OrderStatusUpdateRequestInterface {
  userId: number;
  status: OrderStatusEnum;
}
