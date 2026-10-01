import { TransactionHost } from "@nestjs-cls/transactional";
import { TransactionalAdapterTypeOrm } from "@nestjs-cls/transactional-adapter-typeorm";
import { Injectable } from "@nestjs/common";
import { BaseJobInterface } from "../../generic/rabbitmq/interface/base-job.interface.js";
import { EmailInbox } from "../entity/email-inbox.entity.js";
import { isDefined } from "testcontainers/build/common/type-guards.js";

@Injectable()
export class EmailInboxRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {
    
  }

  async isExisted(messageId: BaseJobInterface['id']): Promise<boolean> {
    const emailInbox = this.txHost.tx.getRepository(EmailInbox); 
    const inbox =  await emailInbox.findOne({
      where: {
        messageId
      }
    })

    return isDefined(inbox)
  }

  async create(messageId: BaseJobInterface['id']): Promise<EmailInbox> {
    const emailInbox = this.txHost.tx.getRepository(EmailInbox);
    return await emailInbox.save(emailInbox.create({
      messageId
    }));
  }
}