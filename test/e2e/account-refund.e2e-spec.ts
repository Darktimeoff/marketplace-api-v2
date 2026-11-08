import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type { AccountCustomerChargeRpc, AccountCustomerRefundRpc } from '@marketplace/messaging-contracts';
import { AccountCustomerChargeCommandHandler } from '../../src/account/command-handler/account-customer-charge.command-handler.js';
import { AccountCustomerRefundCommandHandler } from '../../src/account/command-handler/account-customer-refund.command-handler.js';
import { AppModule } from '../../src/app.module.js';
import { Account } from '../../src/account/entity/account.entity.js';
import { Transaction } from '../../src/account/entity/transaction.entity.js';
import { TransactionTypeEnum } from '../../src/account/enum/transaction-type.enum.js';
import { aUser } from '../support/builders.js';
import { truncateAllTables } from '../support/isolation.js';

describe('Account refund (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  function charge(chargeId: string, customerPublicId: string, amount: string): Promise<AccountCustomerChargeRpc.ResponseType> {
    return app.get(AccountCustomerChargeCommandHandler).execute({ chargeId, customerPublicId, amount });
  }

  function refund(chargeId: string, customerPublicId: string, amount: string): Promise<AccountCustomerRefundRpc.ResponseType> {
    return app.get(AccountCustomerRefundCommandHandler).execute({ chargeId, customerPublicId, amount });
  }

  async function fundedCustomer(balance: string): Promise<string> {
    const customer = await aUser(dataSource.manager);
    await dataSource.query(`INSERT INTO "Account" ("publicId", "balance") VALUES ($1, $2)`, [customer.publicId, balance]);
    return customer.publicId;
  }

  function balanceOf(publicId: string): Promise<string | undefined> {
    return dataSource.getRepository(Account).findOneBy({ publicId }).then((account) => account?.balance);
  }

  it('refunds an applied charge once', async () => {
    const customerPublicId = await fundedCustomer('100.00');
    const chargeId = randomUUID();

    expect(await charge(chargeId, customerPublicId, '40.00')).toEqual({ status: 'success' });
    expect(await refund(chargeId, customerPublicId, '40.00')).toEqual({ status: 'refunded' });
    expect(await refund(chargeId, customerPublicId, '40.00')).toEqual({ status: 'refunded' });

    expect(await balanceOf(customerPublicId)).toBe('100.00');
    expect((await dataSource.getRepository(Transaction).findBy({ account: { publicId: customerPublicId } })).map(({ type }) => type).toSorted()).toEqual(
      [TransactionTypeEnum.PAYMENT, TransactionTypeEnum.REFUND].toSorted(),
    );
  });

  it('answers not_charged for a refund before its charge and never applies the late charge', async () => {
    const customerPublicId = await fundedCustomer('100.00');
    const chargeId = randomUUID();

    expect(await refund(chargeId, customerPublicId, '40.00')).toEqual({ status: 'not_charged' });
    await charge(chargeId, customerPublicId, '40.00');

    expect(await balanceOf(customerPublicId)).toBe('100.00');
    expect(await dataSource.getRepository(Transaction).countBy({ account: { publicId: customerPublicId } })).toBe(0);
  });
});
