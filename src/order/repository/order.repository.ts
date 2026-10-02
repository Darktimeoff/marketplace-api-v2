import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Order, type OrderCreateEntityInterface } from '../entity/order.entity.js';
import { OrderStatusEnum } from '@marketplace/contracts-core';

@Injectable()
export class OrderRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: OrderCreateEntityInterface): Promise<Order> {
    const orders = this.txHost.tx.getRepository(Order);
    return orders.save(orders.create(input));
  }

  async updateStatusById(id: Order['id'], status: OrderStatusEnum): Promise<Order> {
    const orders = this.txHost.tx.getRepository(Order);
    await orders.update(id, { status });
    return this.findByIdOrFail(id);
  }

  async findByIdOrFail(id: Order['id']): Promise<Order> {
    return await this.txHost.tx.getRepository(Order).findOneOrFail({
      where: { id },
      relations: { lines: true, orderRecipient: true },
    })
  }
}
