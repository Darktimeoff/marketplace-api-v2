import { CurrencyEnum } from '../../entities/enums.js';
import { CreatePhoneDto } from '../../phone/dto/create-phone.dto.js';
import { CreateDeliveryAddressDto } from '../../delivery-address/dto/create-delivery-address.dto.js';

export class CreateOrderRecipientDto {
  buyerId: number;
  fullName: string;
  phone: CreatePhoneDto;
  deliveryAddress: CreateDeliveryAddressDto;
}

export class CreateOrderItemDto {
  productOfferId: number;
  quantity: number;
}

export class CreateOrderDto {
  recipient: CreateOrderRecipientDto;
  items: CreateOrderItemDto[];
  currency: CurrencyEnum;
}
