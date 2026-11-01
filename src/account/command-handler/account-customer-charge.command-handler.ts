import { AccountCustomerChargeRpc } from "@marketplace/messaging-contracts";
import { Injectable, Logger } from "@nestjs/common";
import { AccountRepository } from "../repository/account.repository.js";
import { Transactional } from "@nestjs-cls/transactional";
import { AccountCustomerChargeRejectedException } from "../exception/insufficient-stock.exception.js";
import { AccountInboxService } from "../service/account-inbox.service.js";
import { AccountInboxConsumerEnum } from "../enum/account-inbox-consumer.enum.js";
import { TransactionStatusEnum } from '../enum/transaction-status.enum.js';
import { TransactionTypeEnum } from '../enum/transaction-type.enum.js';

@Injectable()
export class AccountCustomerChargeCommandHandler {
  private readonly logger = new Logger(AccountCustomerChargeCommandHandler.name)

  constructor(
    private readonly repository: AccountRepository,
    private readonly inbox: AccountInboxService,
  ) {}

  async execute(request: AccountCustomerChargeRpc.RequestInterface): Promise<AccountCustomerChargeRpc.ResponseType> {
    try {
      const applied = await this.inbox.processOnce(AccountInboxConsumerEnum.CUSTOMER_CHARGE, request.chargeId, () => this.charge(request))
      this.logger.log(`${applied ? 'charged' : 'skipped charge'} id=${request.chargeId}`)
      return { status: 'success' }
    } catch (e) {
      if (e instanceof AccountCustomerChargeRejectedException) {
        return { status: 'rejected', reason: e.reason, available: e.balance.toFixed(2) }
      }

      throw e
    }
  }

  @Transactional()
  private async charge({ amount, customerPublicId }: AccountCustomerChargeRpc.RequestInterface): Promise<void> {
    const accountId = await this.repository.debit(customerPublicId, Number(amount).toFixed(2));

    if (accountId === null) {
      const balance = await this.repository.findBalance(customerPublicId);

      if (balance === null) {
        throw new AccountCustomerChargeRejectedException('customer_not_found')
      }

      throw new AccountCustomerChargeRejectedException('insufficient_amount', Number(amount), balance)
    }

    await this.repository.create({
      accountId,
      amount: Number(amount).toFixed(2),
      type: TransactionTypeEnum.PAYMENT,
      status: TransactionStatusEnum.SUCCESS,
    });
  }
}
