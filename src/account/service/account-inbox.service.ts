import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { AccountInboxRepository } from "../repository/account-inbox.repository.js";
import { AccountInbox } from "../entity/account-inbox.entity.js";

@Injectable()
export class AccountInboxService {
  constructor(private readonly inbox: AccountInboxRepository) {}

  @Transactional()
  async processOnce(consumer: AccountInbox['consumer'], messageId: AccountInbox['messageId'], effect: () => Promise<void>): Promise<boolean> {
    if (!(await this.inbox.createIfAbsent({ consumer, messageId }))) {
      return false
    }

    await effect()
    return true
  }

  isProcessed(consumer: AccountInbox['consumer'], messageId: AccountInbox['messageId']): Promise<boolean> {
    return this.inbox.exists({ consumer, messageId })
  }
}
