import type { CountryCodeEnum } from '../enum/country-code.enum.js';

export interface PhoneEntityInterface {
  id: number;
  countryCode: CountryCodeEnum;
  rawNumber: string;
  fullNumber: string;
  nationalNumber: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
