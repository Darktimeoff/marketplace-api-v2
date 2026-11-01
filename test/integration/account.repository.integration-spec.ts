import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../../src/account/entity/account.entity.js';
import { Transaction } from '../../src/account/entity/transaction.entity.js';
import { AccountRepository } from '../../src/account/repository/account.repository.js';
import { TransactionStatusEnum } from '../../src/account/enum/transaction-status.enum.js';
import { TransactionTypeEnum } from '../../src/account/enum/transaction-type.enum.js';
import { createTestModule, type TestModule } from '../support/test-module.js';
import { truncateAllTables } from '../support/isolation.js';

@Module({
  imports: [TypeOrmModule.forFeature([Account, Transaction])],
  providers: [AccountRepository],
})
class AccountTestModule {}

describe('AccountRepository', () => {
  let testModule: TestModule;
  let accounts: AccountRepository;

  beforeAll(async () => {
    testModule = await createTestModule([AccountTestModule]);
    accounts = testModule.app.get(AccountRepository);
  });

  afterEach(async () => {
    await truncateAllTables(testModule.dataSource);
  });

  afterAll(async () => {
    await testModule.close();
  });

  function account(publicId: string): Promise<Account | null> {
    return testModule.dataSource.getRepository(Account).findOneBy({ publicId });
  }

  it('creates one account per person, keyed by the person publicId', async () => {
    const person = randomUUID();

    expect(await accounts.createIfAbsent(person)).toBe(true);
    expect(await accounts.createIfAbsent(person)).toBe(false);

    expect(await account(person)).toMatchObject({ id: expect.any(Number), publicId: person, balance: '0.00' });
  });

  it('debits only when the balance covers the amount and answers the internal account id', async () => {
    const person = randomUUID();
    await accounts.credit(person, '100.00');
    const { id } = (await account(person))!;

    expect(await accounts.debit(person, '60.00')).toBe(id);
    expect(await accounts.debit(person, '60.00')).toBeNull();
    expect(await accounts.debit(randomUUID(), '1.00')).toBeNull();

    expect((await account(person))!.balance).toBe('40.00');
  });

  it('credits an existing account or opens one, always answering the same id', async () => {
    const person = randomUUID();

    const opened = await accounts.credit(person, '10.00');
    const topped = await accounts.credit(person, '5.50');

    expect(topped).toBe(opened);
    expect((await account(person))!.balance).toBe('15.50');
  });

  it('links transactions to the account by its internal id', async () => {
    const person = randomUUID();
    const accountId = await accounts.credit(person, '10.00');

    await accounts.create({ accountId, amount: '10.00', type: TransactionTypeEnum.DEPOSIT, status: TransactionStatusEnum.SUCCESS });

    expect(await testModule.dataSource.getRepository(Transaction).countBy({ account: { publicId: person } })).toBe(1);
  });
});
