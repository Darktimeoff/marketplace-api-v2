import { TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterTypeOrm } from "@nestjs-cls/transactional-adapter-typeorm";
import { Injectable } from "@nestjs/common";
import { Inbox, InboxCreateEntityInterface } from "../entity/inbox.entity.js";

@Injectable()
export class InboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async createIfAbsent(input: InboxCreateEntityInterface): Promise<boolean> {
    const result = await this.txHost.tx
      .getRepository(Inbox)
      .createQueryBuilder()
      .insert()
      .into(Inbox)
      .values(input)
      .orIgnore()
      .returning(['messageId'])
      .execute();

    return result.raw.length > 0;
  }
}
