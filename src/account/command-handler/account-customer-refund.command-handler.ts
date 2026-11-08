import { AccountCustomerRefundRpc } from "@marketplace/messaging-contracts";
import { Injectable, Logger } from "@nestjs/common";
import { Transactional } from "@nestjs-cls/transactional";
import { AccountRepository } from "../repository/account.repository.js";
import { AccountInboxService } from "../service/account-inbox.service.js";
import { AccountInboxConsumerEnum } from "../enum/account-inbox-consumer.enum.js";
import { TransactionStatusEnum } from '../enum/transaction-status.enum.js';
import { TransactionTypeEnum } from '../enum/transaction-type.enum.js';

@Injectable()
export class AccountCustomerRefundCommandHandler {
  private readonly logger = new Logger(AccountCustomerRefundCommandHandler.name)

  constructor(
    private readonly repository: AccountRepository,
    private readonly inbox: AccountInboxService,
  ) {}

  async execute(request: AccountCustomerRefundRpc.RequestInterface): Promise<AccountCustomerRefundRpc.ResponseType> {
    let refunded = true
    const applied = await this.inbox.processOnce(AccountInboxConsumerEnum.CUSTOMER_REFUND, request.chargeId, async () => {
      refunded = await this.refund(request)
    })
    this.logger.log(`${applied ? (refunded ? 'refunded' : 'fenced uncharged') : 'skipped refund'} id=${request.chargeId}`)
    return { status: refunded ? 'refunded' : 'not_charged' }
  }

  @Transactional()
  private async refund({ customerPublicId, amount, chargeId }: AccountCustomerRefundRpc.RequestInterface): Promise<boolean> {
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
