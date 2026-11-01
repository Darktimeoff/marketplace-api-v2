import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Transaction, type TransactionCreateEntityInterface } from '../entity/transaction.entity.js';
import { Account } from '../entity/account.entity.js';

@Injectable()
export class AccountRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>) { }

  async debit(publicId: Account['publicId'], amount: string): Promise<Account['id'] | null> {
    const [rows]: [{ id: number }[], number] = await this.txHost.tx.query(
      `UPDATE "Account"
          SET "balance" = "balance" - $2
        WHERE "publicId" = $1
          AND "balance" >= $2
    RETURNING "id"`,
      [publicId, amount],
    );

    return rows[0]?.id ?? null;
  }

  async credit(publicId: Account['publicId'], amount: string): Promise<Account['id']> {
    const [row]: { id: number }[] = await this.txHost.tx.query(
      `INSERT INTO "Account" ("publicId", "balance")
       VALUES ($1, $2)
       ON CONFLICT ("publicId") DO UPDATE SET "balance" = "Account"."balance" + EXCLUDED."balance"
       RETURNING "id"`,
      [publicId, amount],
    );

    return row.id;
  }

  async createIfAbsent(publicId: Account['publicId']): Promise<boolean> {
    const result = await this.txHost.tx
      .getRepository(Account)
      .createQueryBuilder()
      .insert()
      .values({ publicId })
      .orIgnore()
      .returning(['id'])
      .execute();

    return result.raw.length > 0;
  }

  async findBalance(publicId: Account['publicId']): Promise<number | null> {
    const account = await this.txHost.tx.getRepository(Account).findOne({ where: { publicId } });
    return account ? Number(account.balance) : null;
  }

  create(input: TransactionCreateEntityInterface): Promise<Transaction> {
    const transactions = this.txHost.tx.getRepository(Transaction);
    return transactions.save(transactions.create(input));
  }
}
