import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Transaction, type TransactionCreateEntityInterface } from '../entity/transaction.entity.js';
import { Account } from '../entity/account.entity.js';

@Injectable()
export class AccountRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) { }

  async debit(customerId: Account['customerId'], amount: string): Promise<boolean> {
    const [rows]: [{ customerId: number }[], number] = await this.txHost.tx.query(
      `UPDATE "Account"
          SET "balance" = "balance" - $2
        WHERE "customerId" = $1
          AND "balance" >= $2
    RETURNING "customerId"`,
      [customerId, amount],
    );

    return rows.length > 0;
  }

  async credit(customerId: Account['customerId'], amount: string): Promise<void> {
    await this.txHost.tx.query(
      `INSERT INTO "Account" ("customerId", "balance")
       VALUES ($1, $2)
       ON CONFLICT ("customerId") DO UPDATE SET "balance" = "Account"."balance" + EXCLUDED."balance"`,
      [customerId, amount],
    );
  }

  async createIfAbsent(customerId: Account['customerId']): Promise<boolean> {
    const result = await this.txHost.tx
      .getRepository(Account)
      .createQueryBuilder()
      .insert()
      .values({ customerId })
      .orIgnore()
      .returning(['customerId'])
      .execute();

    return result.raw.length > 0;
  }

  async findBalance(customerId: Account['customerId']): Promise<number | null> {
    const account = await this.txHost.tx.getRepository(Account).findOne({ where: { customerId } });
    return account ? Number(account.balance) : null;
  }

  create(input: TransactionCreateEntityInterface): Promise<Transaction> {
    const transactions = this.txHost.tx.getRepository(Transaction);
    return transactions.save(transactions.create(input));
  }
}
