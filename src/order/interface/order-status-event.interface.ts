import { OrderStatusEnum } from '@marketplace/contracts-core';

export interface OrderStatusEvent {
  id: number;
  orderPublicId: string;
  status: OrderStatusEnum;
}
