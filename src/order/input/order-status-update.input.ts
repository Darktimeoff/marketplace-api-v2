import { IsEnum, IsInt, IsPositive } from 'class-validator';
import { OrderStatusEnum } from '../../generic/enum/enums.js';

export class OrderStatusUpdateInput {
  @IsInt()
  @IsPositive()
  userId: number;

  @IsEnum(OrderStatusEnum)
  status: OrderStatusEnum;
}
