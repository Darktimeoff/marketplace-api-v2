import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { DeliveryAddressCreateRequestInterface } from '@marketplace/contracts-core';

export class DeliveryAddressCreateInput implements DeliveryAddressCreateRequestInterface {
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