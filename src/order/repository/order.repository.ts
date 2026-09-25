import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Order, type OrderCreateEntityInterface } from '../entity/order.entity.js';
import { OrderStatusEnum } from '../../generic/enum/enums.js';

@Injectable()
export class OrderRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: OrderCreateEntityInterface): Promise<Order> {
    const orders = this.txHost.tx.getRepository(Order);
    return orders.save(orders.create(input));
  }

  async updateStatusById(id: Order['id'], status: OrderStatusEnum) {
    return await this.txHost.tx.getRepository(Order).update(id, {
     status
   })
  }

  async findByIdOrFail(id: Order['id']): Promise<Order> {
    return await this.txHost.tx.getRepository(Order).findOneOrFail({
      where: { id },
      relations: { items: true, orderRecipient: true },
    })
  }
}
