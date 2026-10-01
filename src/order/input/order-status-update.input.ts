import { IsEnum, IsInt, IsPositive } from 'class-validator';
import { OrderStatusEnum, type OrderStatusUpdateRequestInterface } from '@marketplace/contracts-core';

export class OrderStatusUpdateInput implements OrderStatusUpdateRequestInterface {
  @IsInt()
  @IsPositive()
  userId: number;

  @IsEnum(OrderStatusEnum)
  status: OrderStatusEnum;
}
