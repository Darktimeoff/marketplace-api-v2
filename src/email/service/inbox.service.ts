import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { InboxRepository } from "../repository/inbox.repository.js";
import { Inbox } from "../entity/inbox.entity.js";

@Injectable()
export class InboxService {
  constructor(private readonly inbox: InboxRepository) {}

  @Transactional()
  async processOnce(consumer: Inbox['consumer'], messageId: Inbox['messageId'], effect: () => Promise<void>): Promise<boolean> {
    if (!(await this.inbox.createIfAbsent({ consumer, messageId }))) {
      return false
    }

    await effect()
    return true
  }
}
