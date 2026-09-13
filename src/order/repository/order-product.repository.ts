import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderProduct } from '../entity/order-product.entity.js';

export interface CreateOrderProductInput {
  orderId: number;
  productOfferId: number;
  quantity: number;
  price: string;
  discountPrice?: string | null;
}

@Injectable()
export class OrderProductRepository {
  constructor(
    @InjectRepository(OrderProduct) private readonly orderProducts: Repository<OrderProduct>,
  ) {}

  create(input: CreateOrderProductInput[]): Promise<OrderProduct[]> {
    return this.orderProducts.save(input.map((item) => this.orderProducts.create(item)));
  }
}
