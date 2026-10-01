import type { CurrencyEnum } from '../../generic/enum/currency.enum.js';
import type { OrderStatusEnum } from '../enum/order-status.enum.js';

export interface OrderEntityInterface {
  id: number;
  publicId: string;
  orderRecipientId: number;
  status: OrderStatusEnum;
  totalAmount: string;
  discountAmount: string;
  currency: CurrencyEnum;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
