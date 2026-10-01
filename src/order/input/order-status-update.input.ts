import { IsEnum, IsInt, IsPositive } from 'class-validator';
import { OrderStatusEnum } from '../../generic/enum/enums.js';
import type { OrderStatusUpdateRequestInterface } from '@marketplace/contracts-core';

export class OrderStatusUpdateInput implements OrderStatusUpdateRequestInterface {
  @IsInt()
  @IsPositive()
  userId: number;

  @IsEnum(OrderStatusEnum)
  status: OrderStatusEnum;
}
