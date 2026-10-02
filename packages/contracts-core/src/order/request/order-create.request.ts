import type { CurrencyEnum } from '../../generic/enum/currency.enum.js';
import type { CountryCodeEnum } from '../../generic/enum/country-code.enum.js';

export interface OrderCreateRecipientPhoneRequestInterface {
  countryCode: CountryCodeEnum;
  rawNumber: string;
  fullNumber: string;
  nationalNumber: string;
}

export interface OrderCreateRecipientAddressRequestInterface {
  addressLine: string;
  city: string;
  building?: string | null;
}

export interface OrderCreateRecipientRequestInterface {
  fullName: string;
  phone: OrderCreateRecipientPhoneRequestInterface;
  address: OrderCreateRecipientAddressRequestInterface;
}

export interface OrderCreateItemRequestInterface {
  offerId: number;
  quantity: number;
}

export interface OrderCreateRequestInterface {
  userId: number;
  recipient: OrderCreateRecipientRequestInterface;
  items: OrderCreateItemRequestInterface[];
  currency: CurrencyEnum;
}
