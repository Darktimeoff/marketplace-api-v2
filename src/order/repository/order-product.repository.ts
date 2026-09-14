import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { OrderProduct, type OrderProductCreateEntityInterface } from '../entity/order-product.entity.js';

@Injectable()
export class OrderProductRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: OrderProductCreateEntityInterface[]): Promise<OrderProduct[]> {
    const orderProducts = this.txHost.tx.getRepository(OrderProduct);
    return orderProducts.save(input.map((item) => orderProducts.create(item)));
  }
}
