import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Order, type OrderCreateEntityInterface } from '../entity/order.entity.js';

@Injectable()
export class OrderRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: OrderCreateEntityInterface): Promise<Order> {
    const orders = this.txHost.tx.getRepository(Order);
    return orders.save(orders.create(input));
  }
}
