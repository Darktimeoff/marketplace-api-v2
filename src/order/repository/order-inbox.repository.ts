// TODO(hw-22): remove after homework, the OrderConfirmation consumer exists only for the outbox demos
import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { OrderInbox, type OrderInboxCreateEntityInterface } from '../entity/order-inbox.entity.js';

@Injectable()
export class OrderInboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async createIfAbsent(input: OrderInboxCreateEntityInterface): Promise<boolean> {
    const result = await this.txHost.tx
      .getRepository(OrderInbox)
      .createQueryBuilder()
      .insert()
      .into(OrderInbox)
      .values(input)
      .orIgnore()
      .returning(['messageId'])
      .execute();

    return result.raw.length > 0;
  }
}
