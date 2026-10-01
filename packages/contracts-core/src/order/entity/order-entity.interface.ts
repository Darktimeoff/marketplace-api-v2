import type { CurrencyType } from '../../generic/type/currency.type.js';
import type { OrderStatusType } from '../type/order-status.type.js';

export interface OrderEntityInterface {
  id: number;
  publicId: string;
  orderRecipientId: number;
  status: OrderStatusType;
  totalAmount: string;
  discountAmount: string;
  currency: CurrencyType;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
