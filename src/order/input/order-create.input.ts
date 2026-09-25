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
import { CurrencyEnum } from '../../generic/enum/enums.js';
import { PhoneCreateInput } from '../../phone/input/phone-create.input.js';
import { DeliveryAddressCreateInput } from '../../delivery-address/input/delivery-address-create.input.js';

export class OrderCreateRecipientInput {
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

export class OrderCreateItemInput {
  @IsInt()
  @IsPositive()
  offerId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class OrderCreateInput {
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