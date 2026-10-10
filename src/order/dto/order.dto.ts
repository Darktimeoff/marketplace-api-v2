import { Expose } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsPositive, IsString, IsUUID } from 'class-validator';
import { CurrencyEnum, OrderStatusEnum, type OrderResponseInterface } from '@marketplace/contracts-core';

export class OrderDto implements OrderResponseInterface {
  @Expose()
  @IsInt()
  @IsPositive()
  id: number;

  @Expose()
  @IsUUID()
  publicId: string;

  @Expose()
  @IsEnum(OrderStatusEnum)
  status: OrderStatusEnum;

  @Expose()
  @IsString()
  totalAmount: string;

  @Expose()
  @IsString()
  discountAmount: string;

  @Expose()
  @IsEnum(CurrencyEnum)
  currency: CurrencyEnum;

  @Expose()
  @IsDate()
  createdAt: Date;

  @Expose()
  @IsDate()
  updatedAt: Date;
}