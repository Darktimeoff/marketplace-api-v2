import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { OrderLine, type OrderLineCreateEntityInterface } from '../entity/order-line.entity.js';

@Injectable()
export class OrderLineRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  create(input: OrderLineCreateEntityInterface[]): Promise<OrderLine[]> {
    const orderLines = this.txHost.tx.getRepository(OrderLine);
    return orderLines.save(input.map((item) => orderLines.create(item)));
  }
}
