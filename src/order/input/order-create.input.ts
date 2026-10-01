import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsEnum,
  IsInt,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { CurrencyEnum, type OrderCreateItemRequestInterface, type OrderCreateRecipientRequestInterface, type OrderCreateRequestInterface } from '@marketplace/contracts-core';
import { PhoneCreateInput } from '../../phone/input/phone-create.input.js';
import { DeliveryAddressCreateInput } from '../../delivery-address/input/delivery-address-create.input.js';

export class OrderCreateRecipientInput implements OrderCreateRecipientRequestInterface {
  @IsInt()
  @IsPositive()
  buyerId: number;

  @IsString()
  @MaxLength(201)
  fullName: string;

  @ValidateNested()
  @Type(() => PhoneCreateInput)
  phone: PhoneCreateInput;

  @ValidateNested()
  @Type(() => DeliveryAddressCreateInput)
  deliveryAddress: DeliveryAddressCreateInput;
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