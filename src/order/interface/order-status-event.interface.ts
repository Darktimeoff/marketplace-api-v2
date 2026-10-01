import { OrderStatusEnum } from '../../generic/enum/enums.js';

export interface OrderStatusEvent {
  id: number;
  orderId: number;
  status: OrderStatusEnum;
}
