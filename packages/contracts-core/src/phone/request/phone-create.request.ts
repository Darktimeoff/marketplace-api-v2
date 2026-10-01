import type { CountryCodeType } from '../type/country-code.type.js';

export interface PhoneCreateRequestInterface {
  countryCode: CountryCodeType;
  rawNumber: string;
  fullNumber: string;
  nationalNumber: string;
}
