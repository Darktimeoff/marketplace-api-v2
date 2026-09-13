import { Injectable } from '@nestjs/common';
import { OrderRepository } from '../repository/order.repository.js';
import { CreateOrderDto } from '../dto/create-order.dto.js';
import { Order } from '../entity/order.entity.js';

@Injectable()
export class OrderService {
  constructor(private readonly orderRepository: OrderRepository) {}

  create(dto: CreateOrderDto): Promise<Order> {
    return this.orderRepository.create(dto);
  }
}
