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
    if (!await this.repository.isCustomerHasBalance(customerId)) {
      throw new AccountCustomerChargeRejectedException('customer_not_found')
    }
    
    await this.repository.lockForUpdate(customerId);

    const balance = await this.repository.getBalance(customerId);

    if (balance < Number(amount)) {
      throw new AccountCustomerChargeRejectedException('insufficient_amount', Number(amount), balance)
    }

    await this.repository.create({
      userId: customerId,
      amount: Number(amount).toFixed(2),
      type: TransactionTypeEnum.PAYMENT,
      status: TransactionStatusEnum.SUCCESS,
    });
  }
}