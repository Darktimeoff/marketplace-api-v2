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

  async function charge(chargeId: string, customerPublicId: string, amount: string): Promise<AccountCustomerChargeRequest.ResponseDataType> {
    const { data } = await amqpConnection.request<AccountCustomerChargeRequest.ResponseMessageType>({
      exchange: AccountCustomerChargeRequest.TOPIC,
      routingKey: AccountCustomerChargeRequest.TYPE,
      payload: envelope(chargeId, AccountCustomerChargeRequest.TYPE, { customerPublicId, amount }),
      timeout: 5000,
    });
    return data;
  }

  async function refund(chargeId: string, customerPublicId: string, amount: string): Promise<AccountCustomerRefundRequest.ResponseDataType> {
    const { data } = await amqpConnection.request<AccountCustomerRefundRequest.ResponseMessageType>({
      exchange: AccountCustomerRefundRequest.TOPIC,
      routingKey: AccountCustomerRefundRequest.TYPE,
      payload: envelope(chargeId, AccountCustomerRefundRequest.TYPE, { customerPublicId, amount, chargeId }),
      timeout: 5000,
    });
    return data;
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
