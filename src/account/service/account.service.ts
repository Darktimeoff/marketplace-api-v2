import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../repository/account.repository.js';
import { TransactionStatusEnum, TransactionTypeEnum } from '../../entities/enums.js';
import { User } from '../../entities/user.entity.js';
import { Transactional } from '@nestjs-cls/transactional';

@Injectable()
export class AccountService {
  constructor(private readonly accountRepository: AccountRepository) {}

  @Transactional()
  async charge(userId: User['id'], amount: number): Promise<boolean> {
    await this.accountRepository.lockUserForUpdate(userId);

    const balance = await this.accountRepository.getBalance(userId);

    if (balance < amount) {
      return false;
    }

    await this.accountRepository.create({
      userId,
      amount: amount.toFixed(2),
      type: TransactionTypeEnum.PAYMENT,
      status: TransactionStatusEnum.SUCCESS,
    });

    return true;
  }
}
