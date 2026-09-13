import { Body, Controller, Post } from '@nestjs/common';
import { OrderService } from '../service/order.service.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import { Order } from '../entity/order.entity.js';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@Body() dto: CreateOrderDto): Promise<Order> {
    return this.orderService.create(dto);
  }
}
