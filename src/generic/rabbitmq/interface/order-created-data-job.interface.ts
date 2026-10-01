import { CurrencyEnum, OrderStatusEnum } from "../../enum/enums.js";

export interface OrderCreatedDataJobInterface {
  id: number;
  publicId: string;
  status: OrderStatusEnum;
  totalAmount: string;
  discountAmount: string;
  currency: CurrencyEnum;
  createdAt: Date;
  updatedAt: Date;
}