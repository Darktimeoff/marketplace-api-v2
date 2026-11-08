import type { CurrencyEnum } from '../../generic/enum/currency.enum.js';
import type { OrderStatusEnum } from '../enum/order-status.enum.js';

export interface OrderResponseInterface {
  id: string;
  status: OrderStatusEnum;
  totalAmount: string;
  discountAmount: string;
  currency: CurrencyEnum;
  createdAt: Date;
  updatedAt: Date;
}
