import type { CountryCodeEnum } from '../enum/country-code.enum.js';

export interface PhoneCreateRequestInterface {
  countryCode: CountryCodeEnum;
  rawNumber: string;
  fullNumber: string;
  nationalNumber: string;
}
