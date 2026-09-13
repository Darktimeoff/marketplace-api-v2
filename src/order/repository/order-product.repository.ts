import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
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
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: CreateOrderProductInput[]): Promise<OrderProduct[]> {
    const orderProducts = this.txHost.tx.getRepository(OrderProduct);
    return orderProducts.save(input.map((item) => orderProducts.create(item)));
  }
}
