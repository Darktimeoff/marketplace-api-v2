import { AccountCustomerChargeRequest } from "@marketplace/messaging-contracts";
import { Injectable } from "@nestjs/common";
import { AccountRepository } from "../repository/account.repository.js";
import { Transactional } from "@nestjs-cls/transactional";
import { AccountCustomerChargeRejectedException } from "../exception/insufficient-stock.exception.js";
import { TransactionStatusEnum, TransactionTypeEnum } from "../../generic/enum/enums.js";

@Injectable()
export class AccountCustomerChargeCommandHandler {
  constructor(private readonly repository: AccountRepository) {}

  @Transactional()
  async execute({ amount, customerId }: AccountCustomerChargeRequest.DataInterface) {
    if (!await this.repository.debit(customerId, Number(amount).toFixed(2))) {
      const balance = await this.repository.findBalance(customerId);

      if (balance === null) {
        throw new AccountCustomerChargeRejectedException('customer_not_found')
      }

      throw new AccountCustomerChargeRejectedException('insufficient_amount', Number(amount), balance)
    }

    await this.repository.create({
      customerId,
      amount: Number(amount).toFixed(2),
      type: TransactionTypeEnum.PAYMENT,
      status: TransactionStatusEnum.SUCCESS,
    });
  }
}