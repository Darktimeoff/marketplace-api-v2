import type { CountryCodeEnum } from '../../generic/enum/country-code.enum.js';

export interface IdentityRegisterPhoneRequestInterface {
  countryCode: CountryCodeEnum;
  rawNumber: string;
  fullNumber: string;
  nationalNumber: string;
}

export interface IdentityRegisterRequestInterface {
  email?: string;
  phone?: IdentityRegisterPhoneRequestInterface;
  password: string;
}
