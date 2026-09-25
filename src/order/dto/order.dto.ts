import { Expose } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsPositive, IsString, IsUUID } from 'class-validator';
import { CurrencyEnum, OrderStatusEnum } from '../../generic/enum/enums.js';

export class OrderDto {
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