import { IsEnum, IsString, Matches, MaxLength } from 'class-validator';
import { CountryCodeEnum } from '../../generic/enum/enums.js';

export class PhoneCreateInput {
  @IsEnum(CountryCodeEnum)
  countryCode: CountryCodeEnum;

  @IsString()
  @MaxLength(32)
  rawNumber: string;

  @IsString()
  @MaxLength(16)
  @Matches(/^\+[1-9][0-9]{7,14}$/, { message: 'fullNumber must be in E.164 format' })
  fullNumber: string;

  @IsString()
  @MaxLength(15)
  @Matches(/^[0-9]{4,15}$/, { message: 'nationalNumber must contain 4 to 15 digits' })
  nationalNumber: string;
}