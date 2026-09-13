import { CurrencyEnum, StatusEnum } from '../../entities/enums.js';
import { CreatePhoneDto } from '../../phone/dto/create-phone.dto.js';
import { CreateDeliveryAddressDto } from '../../delivery-address/dto/create-delivery-address.dto.js';

/**
 * Тело POST /order. Клиент передаёт данные телефона и адреса целиком, а не
 * их id: OrderService сам создаёт под них новые строки Phone/DeliveryAddress
 * через PhoneService/DeliveryAddressService (снапшот на момент заказа, как и
 * задумано в схеме — см. OrderRecipient.entity.ts) и получает их id обратно.
 * Так клиент не может подставить чужой phoneId/deliveryAddressId — валидного
 * поля для этого в контракте просто нет.
 */
export class CreateOrderRecipientDto {
  buyerId: number;
  fullName: string;
  phone: CreatePhoneDto;
  deliveryAddress: CreateDeliveryAddressDto;
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
