import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeliveryAddressCreateInput {
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