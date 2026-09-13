import { CurrencyEnum, StatusEnum } from '../../entities/enums.js';

/**
 * Тело POST /order. Ничего не вычисляется и не подставляется сервисом —
 * каждое поле идёт прямиком в соответствующую колонку одной из трёх таблиц
 * (Order, OrderProduct, OrderRecipient), которые создаются как есть.
 */
export class CreateOrderRecipientDto {
  buyerId: number;
  fullName: string;
  phoneId: number;
  deliveryAddressId: number;
}

export class CreateOrderItemDto {
  productOfferId: number;
  quantity: number;
  price: string;
  discountPrice?: string | null;
}

export class CreateOrderDto {
  recipient: CreateOrderRecipientDto;
  items: CreateOrderItemDto[];
  totalAmount: string;
  discountAmount?: string;
  currency: CurrencyEnum;
  status?: StatusEnum;
}
