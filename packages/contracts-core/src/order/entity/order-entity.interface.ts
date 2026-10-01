import type { Currency } from '../../generic/type/currency.type.js';
import type { OrderStatus } from '../type/order-status.type.js';

export interface OrderEntityInterface {
  id: number;
  publicId: string;
  orderRecipientId: number;
  status: OrderStatus;
  totalAmount: string;
  discountAmount: string;
  currency: Currency;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
