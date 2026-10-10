import { TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterTypeOrm } from "@nestjs-cls/transactional-adapter-typeorm";
import { Injectable } from "@nestjs/common";
import { AccountInbox, AccountInboxCreateEntityInterface } from "../entity/account-inbox.entity.js";

@Injectable()
export class AccountInboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async createIfAbsent(input: AccountInboxCreateEntityInterface): Promise<boolean> {
    const result = await this.txHost.tx
      .getRepository(AccountInbox)
      .createQueryBuilder()
      .insert()
      .into(AccountInbox)
      .values(input)
      .orIgnore()
      .returning(['messageId'])
      .execute();

    return result.raw.length > 0;
  }

  exists(input: AccountInboxCreateEntityInterface): Promise<boolean> {
    return this.txHost.tx.getRepository(AccountInbox).exists({ where: input });
  }
}
