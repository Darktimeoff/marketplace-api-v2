import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { OrderBuyer, type OrderBuyerCreateEntityInterface } from '../entity/order-buyer.entity.js';

@Injectable()
export class OrderBuyerRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async createIfAbsent(input: OrderBuyerCreateEntityInterface): Promise<boolean> {
    const result = await this.txHost.tx
      .getRepository(OrderBuyer)
      .createQueryBuilder()
      .insert()
      .into(OrderBuyer)
      .values(input)
      .orIgnore()
      .returning(['identityPublicId'])
      .execute();

    return result.raw.length > 0;
  }

  findByIdentityPublicId(identityPublicId: OrderBuyer['identityPublicId']): Promise<OrderBuyer | null> {
    return this.txHost.tx.getRepository(OrderBuyer).findOneBy({ identityPublicId });
  }
}
