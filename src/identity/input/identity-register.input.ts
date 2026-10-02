import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { CountryCodeEnum, type IdentityRegisterPhoneRequestInterface, type IdentityRegisterRequestInterface } from '@marketplace/contracts-core';

export class IdentityRegisterPhoneInput implements IdentityRegisterPhoneRequestInterface {
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

export class IdentityRegisterInput implements IdentityRegisterRequestInterface {
  @ValidateIf((input: IdentityRegisterInput) => input.email !== undefined || input.phone === undefined)
  @IsEmail({}, { message: 'email must be an email, or phone must be provided' })
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => IdentityRegisterPhoneInput)
  phone?: IdentityRegisterPhoneInput;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
}
