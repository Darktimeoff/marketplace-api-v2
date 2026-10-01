import type { CurrencyEnum } from '../../generic/enum/currency.enum.js';
import type { PhoneCreateRequestInterface } from '../../phone/request/phone-create.request.js';
import type { DeliveryAddressCreateRequestInterface } from '../../delivery-address/request/delivery-address-create.request.js';

export interface OrderCreateRecipientRequestInterface {
  buyerId: number;
  fullName: string;
  phone: PhoneCreateRequestInterface;
  deliveryAddress: DeliveryAddressCreateRequestInterface;
}

export interface OrderCreateItemRequestInterface {
  offerId: number;
  quantity: number;
}

export interface OrderCreateRequestInterface {
  recipient: OrderCreateRecipientRequestInterface;
  items: OrderCreateItemRequestInterface[];
  currency: CurrencyEnum;
}
