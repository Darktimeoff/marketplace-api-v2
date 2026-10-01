import type { Currency } from '../../generic/type/currency.type.js';
import type { PhoneCreateRequest } from '../../phone/request/phone-create.request.js';
import type { DeliveryAddressCreateRequest } from '../../delivery-address/request/delivery-address-create.request.js';

export interface OrderCreateRecipientRequest {
  buyerId: number;
  fullName: string;
  phone: PhoneCreateRequest;
  deliveryAddress: DeliveryAddressCreateRequest;
}

export interface OrderCreateItemRequest {
  offerId: number;
  quantity: number;
}

export interface OrderCreateRequest {
  recipient: OrderCreateRecipientRequest;
  items: OrderCreateItemRequest[];
  currency: Currency;
}
