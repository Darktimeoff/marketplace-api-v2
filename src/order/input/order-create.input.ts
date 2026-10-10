import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsDefined,
  IsEnum,
  IsInt,
  IsPositive,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CountryCodeEnum, CurrencyEnum, type OrderCreateItemRequestInterface, type OrderCreateRecipientAddressRequestInterface, type OrderCreateRecipientPhoneRequestInterface, type OrderCreateRecipientRequestInterface, type OrderCreateRequestInterface } from '@marketplace/contracts-core';

export class OrderCreateRecipientPhoneInput implements OrderCreateRecipientPhoneRequestInterface {
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

export class OrderCreateRecipientAddressInput implements OrderCreateRecipientAddressRequestInterface {
  @IsString()
  @MaxLength(255)
  addressLine: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  building?: string | null;
}

export class OrderCreateRecipientInput implements OrderCreateRecipientRequestInterface {
  @IsString()
  @MaxLength(201)
  @Matches(/\S/, { message: 'fullName must not be blank' })
  fullName: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => OrderCreateRecipientPhoneInput)
  phone: OrderCreateRecipientPhoneInput;

  @IsDefined()
  @ValidateNested()
  @Type(() => OrderCreateRecipientAddressInput)
  address: OrderCreateRecipientAddressInput;
}

export class OrderCreateItemInput implements OrderCreateItemRequestInterface {
  @IsInt()
  @IsPositive()
  offerId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class OrderCreateInput implements OrderCreateRequestInterface {
  @IsInt()
  @IsPositive()
  userId: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => OrderCreateRecipientInput)
  recipient: OrderCreateRecipientInput;

  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => OrderCreateItemInput)
  items: OrderCreateItemInput[];

  @IsEnum(CurrencyEnum)
  currency: CurrencyEnum;
}