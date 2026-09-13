import { CountryCodeEnum } from '../../entities/enums.js';

export class CreatePhoneDto {
  countryCode: CountryCodeEnum;
  rawNumber: string;
  fullNumber: string;
  nationalNumber: string;
}
