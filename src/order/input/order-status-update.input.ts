import { IsEnum, IsInt, IsPositive } from 'class-validator';
import { OrderStatusEnum } from '../../generic/enum/enums.js';
import type { OrderStatusUpdateRequest } from '@marketplace/contracts-core';

export class OrderStatusUpdateInput implements OrderStatusUpdateRequest {
  @IsInt()
  @IsPositive()
  userId: number;

  @IsEnum(OrderStatusEnum)
  status: OrderStatusEnum;
}
