// TODO(hw-23): remove after homework, npm run demo:cache
import { DataSource } from 'typeorm';
import { CurrencyEnum, OrderStatusEnum } from '@marketplace/contracts-core';
import { startDemoApp, report, run } from './demo-harness.js';
import { OrderModule } from '../order/order.module.js';
import { OrderService } from '../order/service/order.service.js';
import { OrderRepository } from '../order/repository/order.repository.js';
import { RedisClientService } from '../generic/redis/redis-client.service.js';
import { orderCacheKey } from '../order/constant/order-cache.constant.js';

const DEMO_USER_ID = 2_100_000_000;
const WARMED = 50;
const CONCURRENT = 20;
const WARM_READS = 100;

await run(async () => {
  let dbCalls = 0;
  const repository = OrderRepository.prototype;
  const findByIdOrFail = repository.findByIdOrFail;
  repository.findByIdOrFail = function (this: OrderRepository, ...args: Parameters<typeof findByIdOrFail>) {
    dbCalls += 1;
    return findByIdOrFail.apply(this, args);
  };

  const app = await startDemoApp([OrderModule]);
  const dataSource = app.get(DataSource);
  const orders = app.get(OrderService);
  const cache = app.get(RedisClientService).cache;

  async function cleanUp(): Promise<void> {
    const leftovers: { id: number; orderRecipientId: number }[] = await dataSource.query(`SELECT "id", "orderRecipientId" FROM "Order" WHERE "userId" = $1`, [DEMO_USER_ID]);
    for (const { id } of leftovers) {
      await cache.del(orderCacheKey(id), `lock:${orderCacheKey(id)}`);
    }
    await dataSource.query(`DELETE FROM "Order" WHERE "userId" = $1`, [DEMO_USER_ID]);
    await dataSource.query(`DELETE FROM "OrderRecipient" WHERE "id" = ANY($1)`, [leftovers.map(({ orderRecipientId }) => orderRecipientId)]);
  }

  try {
    await cleanUp();

    const ids: number[] = [];
    for (let i = 0; i < WARMED; i += 1) {
      const [recipient] = await dataSource.query(
        `INSERT INTO "OrderRecipient" ("fullName", "phoneCountryCode", "phoneRawNumber", "phoneFullNumber", "phoneNationalNumber", "addressLine", "addressCity") VALUES ('Redis Demo', 'UA', '+380501234567', '+380501234567', '0501234567', 'Khreshchatyk St, 1', 'Kyiv') RETURNING "id"`,
      );
      const [order] = await dataSource.query(
        `INSERT INTO "Order" ("userId", "orderRecipientId", "totalAmount", "discountAmount", "currency", "status") VALUES ($1, $2, '100.00', '0.00', $3, $4) RETURNING "id"`,
        [DEMO_USER_ID, recipient.id, CurrencyEnum.UAH, OrderStatusEnum.paid],
      );
      ids.push(order.id);
    }

    for (const id of ids) {
      await orders.findById(id);
    }
    const ttls = await Promise.all(ids.map((id) => cache.ttl(orderCacheKey(id))));
    const warmed = ttls.filter((ttl) => ttl > 0).length;

    const [, policy] = (await cache.config('GET', 'maxmemory-policy')) as [string, string];
    const [, maxmemory] = (await cache.config('GET', 'maxmemory')) as [string, string];

    const hotId = ids[0];
    await cache.del(orderCacheKey(hotId));
    dbCalls = 0;
    await Promise.all(Array.from({ length: CONCURRENT }, () => orders.findById(hotId)));
    const concurrentDbCalls = dbCalls;

    dbCalls = 0;
    for (let i = 0; i < WARM_READS; i += 1) {
      await orders.findById(hotId);
    }
    const warmDbCalls = dbCalls;

    return report(
      {
        'cache-lru': policy !== 'noeviction' ? 1 : 0,
        'cache-maxmemory': Number(maxmemory) > 0 ? 1 : 0,
        warmed,
        'ttl-distinct': new Set(ttls).size,
        concurrent: CONCURRENT,
        'db-calls': concurrentDbCalls,
        'db-calls-warm': warmDbCalls,
      },
      [
        ['cache evicts', policy !== 'noeviction'],
        ['cache has a memory limit', Number(maxmemory) > 0],
        ['at least 50 keys warmed', warmed >= WARMED],
        ['ttl has jitter', new Set(ttls).size > 1],
        ['one database read for concurrent misses', concurrentDbCalls === 1],
        ['no database reads on a warm key', warmDbCalls === 0],
      ],
    );
  } finally {
    await cleanUp();
    await app.close();
  }
});
