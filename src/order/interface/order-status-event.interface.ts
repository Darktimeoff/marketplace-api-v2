import { OrderStatusEnum } from '@marketplace/contracts-core';

export interface OrderStatusEvent {
  id: number;
  orderId: number;
  status: OrderStatusEnum;
}
