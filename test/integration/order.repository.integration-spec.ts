import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../src/order/entity/order.entity.js';
import { OrderLine } from '../../src/order/entity/order-line.entity.js';
import { OrderRecipient } from '../../src/order/entity/order-recipient.entity.js';
import { OrderBuyer } from '../../src/order/entity/order-buyer.entity.js';
import { randomUUID } from 'node:crypto';
import { OrderRepository } from '../../src/order/repository/order.repository.js';
import { OrderLineRepository } from '../../src/order/repository/order-line.repository.js';
import { CurrencyEnum } from '@marketplace/contracts-core';
import { createTestModule, type TestModule } from '../support/test-module.js';
import { truncateAllTables } from '../support/isolation.js';
import { anOrderRecipient, aSellerOffer } from '../support/builders.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderLine, OrderRecipient, OrderBuyer])],
  providers: [OrderRepository, OrderLineRepository],
})
class OrderTestModule {}

describe('OrderRepository', () => {
  let testModule: TestModule;
  let repository: OrderRepository;
  let orderLines: OrderLineRepository;

  beforeAll(async () => {
    testModule = await createTestModule([OrderTestModule]);
    repository = testModule.app.get(OrderRepository);
    orderLines = testModule.app.get(OrderLineRepository);
  });

  afterEach(async () => {
    await truncateAllTables(testModule.dataSource);
  });

  afterAll(async () => {
    await testModule.close();
  });

  async function aBuyerId(): Promise<number> {
    const buyer = await testModule.dataSource.getRepository(OrderBuyer).save({ publicId: randomUUID() });
    return buyer.id;
  }

  it('rejects a second order for the same recipient (unique constraint)', async () => {
    const recipient = await anOrderRecipient(testModule.dataSource.manager);
    await repository.create({
      buyerId: await aBuyerId(),
      orderRecipientId: recipient.id,
      totalAmount: '10.00',
      discountAmount: '0.00',
      currency: CurrencyEnum.UAH,
    });

    await expect(
      repository.create({
        buyerId: await aBuyerId(),
        orderRecipientId: recipient.id,
        totalAmount: '20.00',
        discountAmount: '0.00',
        currency: CurrencyEnum.UAH,
      }),
    ).rejects.toThrow(/duplicate key value/);
  });

  it('rejects an order referencing a non-existent recipient (FK constraint)', async () => {
    await expect(
      repository.create({
        buyerId: await aBuyerId(),
        orderRecipientId: 999999,
        totalAmount: '10.00',
        discountAmount: '0.00',
        currency: CurrencyEnum.UAH,
      }),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it('findByIdOrFail joins items and orderRecipient in one read', async () => {
    const recipient = await anOrderRecipient(testModule.dataSource.manager);
    const offer = await aSellerOffer(testModule.dataSource.manager, {
      price: '50.00',
    });

    const order = await repository.create({
      buyerId: await aBuyerId(),
      orderRecipientId: recipient.id,
      totalAmount: '100.00',
      discountAmount: '0.00',
      currency: CurrencyEnum.UAH,
    });

    await orderLines.create([
      {
        orderId: order.id,
        offerPublicId: offer.publicId,
        quantity: 2,
        unitPrice: '50.00',
        unitDiscountPrice: null,
      },
    ]);

    const found = await repository.findByIdOrFail(order.id);

    expect(found.orderRecipient.id).toBe(recipient.id);
    expect(found.lines).toHaveLength(1);
    expect(found.lines[0].offerPublicId).toBe(offer.publicId);
  });

  it('findByIdOrFail rejects for a missing id', async () => {
    await expect(repository.findByIdOrFail(999999)).rejects.toThrow();
  });
});
