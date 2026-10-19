import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AccountCustomerChargeRequest, AccountCustomerRefundRequest, SourceEnum } from '@marketplace/messaging-contracts';
import { AppModule } from '../../src/app.module.js';
import { Account } from '../../src/account/entity/account.entity.js';
import { Transaction } from '../../src/account/entity/transaction.entity.js';
import { TransactionTypeEnum } from '../../src/account/enum/transaction-type.enum.js';
import { aUser } from '../support/builders.js';
import { truncateAllTables } from '../support/isolation.js';

describe('Account refund (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let amqpConnection: AmqpConnection;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    amqpConnection = app.get(AmqpConnection);
  });

  afterEach(async () => {
    await truncateAllTables(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  function envelope<T extends string, D>(id: string, type: T, data: D) {
    return {
      specversion: '1.0' as const,
      id,
      source: SourceEnum.ORDER,
      type,
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      subject: id,
      correlationid: id,
      data,
    };
  }

  async function charge(chargeId: string, customerId: number, amount: string): Promise<AccountCustomerChargeRequest.ResponseDataType> {
    const { data } = await amqpConnection.request<AccountCustomerChargeRequest.ResponseMessageType>({
      exchange: AccountCustomerChargeRequest.TOPIC,
      routingKey: AccountCustomerChargeRequest.TYPE,
      payload: envelope(chargeId, AccountCustomerChargeRequest.TYPE, { customerId, amount }),
      timeout: 5000,
    });
    return data;
  }

  async function refund(chargeId: string, customerId: number, amount: string): Promise<AccountCustomerRefundRequest.ResponseDataType> {
    const { data } = await amqpConnection.request<AccountCustomerRefundRequest.ResponseMessageType>({
      exchange: AccountCustomerRefundRequest.TOPIC,
      routingKey: AccountCustomerRefundRequest.TYPE,
      payload: envelope(chargeId, AccountCustomerRefundRequest.TYPE, { customerId, amount, chargeId }),
      timeout: 5000,
    });
    return data;
  }

  async function fundedCustomer(balance: string): Promise<number> {
    const customer = await aUser(dataSource.manager);
    await dataSource.query(`INSERT INTO "Account" ("customerId", "balance") VALUES ($1, $2)`, [customer.id, balance]);
    return customer.id;
  }

  function balanceOf(customerId: number): Promise<string | undefined> {
    return dataSource.getRepository(Account).findOneBy({ customerId }).then((account) => account?.balance);
  }

  it('refunds an applied charge once', async () => {
    const customerId = await fundedCustomer('100.00');
    const chargeId = randomUUID();

    expect(await charge(chargeId, customerId, '40.00')).toEqual({ status: 'success' });
    expect(await refund(chargeId, customerId, '40.00')).toEqual({ status: 'refunded' });
    expect(await refund(chargeId, customerId, '40.00')).toEqual({ status: 'refunded' });

    expect(await balanceOf(customerId)).toBe('100.00');
    expect((await dataSource.getRepository(Transaction).findBy({ customerId })).map(({ type }) => type).toSorted()).toEqual(
      [TransactionTypeEnum.PAYMENT, TransactionTypeEnum.REFUND].toSorted(),
    );
  });

  it('answers not_charged for a refund before its charge and never applies the late charge', async () => {
    const customerId = await fundedCustomer('100.00');
    const chargeId = randomUUID();

    expect(await refund(chargeId, customerId, '40.00')).toEqual({ status: 'not_charged' });
    await charge(chargeId, customerId, '40.00');

    expect(await balanceOf(customerId)).toBe('100.00');
    expect(await dataSource.getRepository(Transaction).countBy({ customerId })).toBe(0);
  });
});
