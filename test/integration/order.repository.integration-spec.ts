import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { OrderModule } from '../../src/order/order.module.js';
import { OrderRepository } from '../../src/order/repository/order.repository.js';
import { OrderProductRepository } from '../../src/order/repository/order-product.repository.js';
import { CurrencyEnum } from '../../src/entities/enums.js';
import { createTestModule, type TestModule } from '../support/test-module.js';
import { truncateAllTables } from '../support/isolation.js';
import { anOrderRecipient, aProductOffer } from '../support/builders.js';

describe('OrderRepository', () => {
  let testModule: TestModule;
  let repository: OrderRepository;
  let orderProducts: OrderProductRepository;

  beforeAll(async () => {
    testModule = await createTestModule([OrderModule]);
    repository = testModule.app.get(OrderRepository);
    orderProducts = testModule.app.get(OrderProductRepository);
  });

  afterEach(async () => {
    await truncateAllTables(testModule.dataSource);
  });

  afterAll(async () => {
    await testModule.close();
  });

  it('rejects a second order for the same recipient (unique constraint)', async () => {
    const recipient = await anOrderRecipient(testModule.dataSource.manager);
    await repository.create({
      orderRecipientId: recipient.id,
      totalAmount: '10.00',
      discountAmount: '0.00',
      currency: CurrencyEnum.UAH,
    });

    await expect(
      repository.create({
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
        orderRecipientId: 999999,
        totalAmount: '10.00',
        discountAmount: '0.00',
        currency: CurrencyEnum.UAH,
      }),
    ).rejects.toThrow(/violates foreign key constraint/);
  });

  it('findByIdOrFail joins items and orderRecipient in one read', async () => {
    const recipient = await anOrderRecipient(testModule.dataSource.manager);
    const offer = await aProductOffer(testModule.dataSource.manager, {
      price: '50.00',
    });

    const order = await repository.create({
      orderRecipientId: recipient.id,
      totalAmount: '100.00',
      discountAmount: '0.00',
      currency: CurrencyEnum.UAH,
    });

    await orderProducts.create([
      {
        orderId: order.id,
        productOfferId: offer.id,
        quantity: 2,
        price: '50.00',
        discountPrice: null,
      },
    ]);

    const found = await repository.findByIdOrFail(order.id);

    expect(found.orderRecipient.id).toBe(recipient.id);
    expect(found.items).toHaveLength(1);
    expect(found.items[0].productOfferId).toBe(offer.id);
  });

  it('findByIdOrFail rejects for a missing id', async () => {
    await expect(repository.findByIdOrFail(999999)).rejects.toThrow();
  });
});
