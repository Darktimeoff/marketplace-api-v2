import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Transaction, type TransactionCreateEntityInterface } from '../../entities/transaction.entity.js';
import { TransactionStatusEnum, TransactionTypeEnum } from '../../entities/enums.js';
import { User } from '../../entities/user.entity.js';

@Injectable()
export class AccountRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) {}

  async lockUserForUpdate(userId: User['id']): Promise<void> {
    await this.txHost.tx.getRepository(User).findOne({
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async getBalance(userId: User['id']): Promise<number> {
    const row = await this.txHost.tx
      .getRepository(Transaction)
      .createQueryBuilder('transaction')
      .select(
        `COALESCE(SUM(CASE WHEN transaction.type = :deposit THEN transaction.amount ELSE -transaction.amount END), 0)`,
        'balance',
      )
      .where('transaction.userId = :userId', { userId })
      .andWhere('transaction.status = :status', { status: TransactionStatusEnum.SUCCESS })
      .setParameters({ deposit: TransactionTypeEnum.DEPOSIT })
      .getRawOne<{ balance: string }>();

    return Number(row?.balance ?? 0);
  }

  create(input: TransactionCreateEntityInterface): Promise<Transaction> {
    const transactions = this.txHost.tx.getRepository(Transaction);
    return transactions.save(transactions.create(input));
  }
}
