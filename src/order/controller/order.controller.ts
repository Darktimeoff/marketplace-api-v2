import { Body, Controller, Post } from '@nestjs/common';
import { OrderService } from '../service/order.service.js';
import { OrderCreateInput } from '../input/order-create.input.js';
import { OrderDto } from '../dto/order.dto.js';
import { ResponseDto } from '../../generic/validation/response-dto.decorator.js';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @ResponseDto(OrderDto)
  @Post()
  create(@Body() input: OrderCreateInput): Promise<OrderDto> {
    return this.orderService.create(input);
  }
}