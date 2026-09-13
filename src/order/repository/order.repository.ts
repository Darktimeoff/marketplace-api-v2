import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entity/order.entity.js';
import { CurrencyEnum } from '../../entities/enums.js';

export interface CreateOrderInput {
  orderRecipientId: number;
  totalAmount: string;
  discountAmount: string;
  currency: CurrencyEnum;
}

@Injectable()
export class OrderRepository {
  constructor(@InjectRepository(Order) private readonly orders: Repository<Order>) {}

  create(input: CreateOrderInput): Promise<Order> {
    return this.orders.save(this.orders.create(input));
  }
}
