import { IsOptional, IsString, MaxLength } from 'class-validator';
import type { DeliveryAddressCreateRequest } from '@marketplace/contracts-core';

export class DeliveryAddressCreateInput implements DeliveryAddressCreateRequest {
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