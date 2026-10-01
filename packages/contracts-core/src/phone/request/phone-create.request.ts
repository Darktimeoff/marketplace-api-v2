import type { CountryCode } from '../type/country-code.type.js';

export interface PhoneCreateRequest {
  countryCode: CountryCode;
  rawNumber: string;
  fullNumber: string;
  nationalNumber: string;
}
