import { AccountCustomerRefundRequest } from "@marketplace/messaging-contracts";
import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { AccountRepository } from "../repository/account.repository.js";
import { AccountInboxService } from "../service/account-inbox.service.js";
import { AccountInboxConsumerEnum } from "../enum/account-inbox-consumer.enum.js";
import { TransactionStatusEnum } from '../enum/transaction-status.enum.js';
import { TransactionTypeEnum } from '../enum/transaction-type.enum.js';

@Injectable()
export class AccountCustomerRefundCommandHandler {
  constructor(
    private readonly repository: AccountRepository,
    private readonly inbox: AccountInboxService,
  ) {}

  @Transactional()
  async execute({ customerPublicId, amount, chargeId }: AccountCustomerRefundRequest.DataInterface): Promise<boolean> {
    if (await this.inbox.markProcessed(AccountInboxConsumerEnum.CUSTOMER_CHARGE, chargeId)) {
      return false;
    }

    const accountId = await this.repository.credit(customerPublicId, Number(amount).toFixed(2));
    await this.repository.create({
      accountId,
      amount: Number(amount).toFixed(2),
      type: TransactionTypeEnum.REFUND,
      status: TransactionStatusEnum.SUCCESS,
    });

    return true;
  }
}
