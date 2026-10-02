import { AccountCustomerRefundCommand } from "@marketplace/messaging-contracts";
import { Injectable } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { AccountRepository } from "../repository/account.repository.js";
import { AccountInboxService } from "../service/account-inbox.service.js";
import { AccountInboxConsumerEnum } from "../enum/account-inbox-consumer.enum.js";
import { AccountCustomerRefundWithoutChargeException } from "../exception/account-customer-refund-without-charge.exception.js";
import { TransactionStatusEnum, TransactionTypeEnum } from "../../generic/enum/enums.js";

@Injectable()
export class AccountCustomerRefundCommandHandler {
  constructor(
    private readonly repository: AccountRepository,
    private readonly inbox: AccountInboxService,
  ) {}

  @Transactional()
  async execute({ customerId, amount, chargeId }: AccountCustomerRefundCommand.DataInterface) {
    if (!await this.inbox.isProcessed(AccountInboxConsumerEnum.CUSTOMER_CHARGE, chargeId)) {
      throw new AccountCustomerRefundWithoutChargeException(chargeId)
    }

    await this.repository.create({
      userId: customerId,
      amount: Number(amount).toFixed(2),
      type: TransactionTypeEnum.REFUND,
      status: TransactionStatusEnum.SUCCESS,
    });
  }
}
