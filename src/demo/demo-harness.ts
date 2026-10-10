// TODO(hw-22): remove after homework, demo harness for npm run demo:outbox, demo:crash-write, demo:crash-relay
import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import { Module, ValidationPipe, type INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE, NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CountryCodeEnum, CurrencyEnum } from '@marketplace/contracts-core';
import { OrderCreatedEvent } from '@marketplace/messaging-contracts';
import { EnvironmentModule } from '../generic/environment/environment.module.js';
import { DBModule } from '../generic/db/db.module.js';
import { OrderModule } from '../order/order.module.js';
import { ValidationResponseInterceptor } from '../generic/validation/validation-response.interceptor.js';
import { OrderOutboxRelayService } from '../order/service/order-outbox-relay.service.js';
import { OrderConfirmationEventsGateway } from '../order/gateway/order-confirmation-events.gateway.js';
import { OrderConfirmCommandHandler } from '../order/command-handler/order-confirm.command-handler.js';
import { OrderInboxConsumerEnum } from '../order/enum/order-inbox-consumer.enum.js';
import { Seller } from '../seller/entity/seller.entity.js';
import { Product } from '../product/entity/product.entity.js';
import { ProductTranslation } from '../product/entity/product-translation.entity.js';
import { ProductVariant } from '../product-variant/entity/product-variant.entity.js';
import { Brand } from '../brand/entity/brand.entity.js';
import { BrandTranslation } from '../brand/entity/brand-translation.entity.js';
import { Category } from '../category/entity/category.entity.js';
import { CategoryTranslation } from '../category/entity/category-translation.entity.js';

@Module({
  imports: [
    EnvironmentModule,
    DBModule,
    TypeOrmModule.forFeature([Seller, Product, ProductTranslation, ProductVariant, Brand, BrandTranslation, Category, CategoryTranslation]),
    OrderModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: () => new ValidationPipe({ transform: true, whitelist: true }) },
    { provide: APP_INTERCEPTOR, useClass: ValidationResponseInterceptor },
  ],
})
class DemoModule {}

export interface DemoCountsInterface {
  orders: number;
  outbox: number;
  published: number;
  deliveries: number;
  applied: number;
  effect: number;
  processed: number;
}

export class Demo {
  readonly userId = randomInt(1_000_000_000, 2_000_000_000);
  private deliveries = 0;
  private applied = 0;

  private constructor(
    private readonly app: INestApplication,
    private readonly url: string,
    readonly dataSource: DataSource,
  ) {}

  static async start(): Promise<Demo> {
    const demo: { current?: Demo } = {};
    const gateway = OrderConfirmationEventsGateway.prototype;
    const handle = gateway.handle;
    gateway.handle = async function (this: OrderConfirmationEventsGateway, event: unknown) {
      const created = event as { type?: string; data?: { userId?: number } } | null;
      if (created?.type === OrderCreatedEvent.TYPE && created.data?.userId === demo.current?.userId) {
        demo.current!.deliveries += 1;
      }
      return handle.call(this, event);
    };
    const handler = OrderConfirmCommandHandler.prototype;
    const execute = handler.execute;
    handler.execute = async function (this: OrderConfirmCommandHandler, ...args: Parameters<typeof execute>) {
      const applied = await execute.apply(this, args);
      if (applied && args[1].userId === demo.current?.userId) {
        demo.current!.applied += 1;
      }
      return applied;
    };

    const app = await NestFactory.create(DemoModule, { logger: ['error'] });
    await app.listen(0, '127.0.0.1');
    demo.current = new Demo(app, await app.getUrl(), app.get(DataSource));
    return demo.current;
  }

  get relay(): OrderOutboxRelayService {
    return this.app.get(OrderOutboxRelayService);
  }

  async placeOrder(idempotencyKey: string): Promise<number> {
    const [offer] = await this.dataSource.query(`SELECT "id" FROM "SellerOffer" ORDER BY "id" LIMIT 1`);
    if (!offer) {
      throw new Error('no SellerOffer found: run npm run seed first');
    }

    const response = await fetch(`${this.url}/order`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
      body: JSON.stringify({
        userId: this.userId,
        recipient: {
          fullName: 'Demo Buyer',
          phone: { countryCode: CountryCodeEnum.UA, rawNumber: '+380501234567', fullNumber: '+380501234567', nationalNumber: '0501234567' },
          address: { addressLine: 'Khreshchatyk St, 1', city: 'Kyiv' },
        },
        items: [{ offerId: offer.id, quantity: 1 }],
        currency: CurrencyEnum.UAH,
      }),
    });
    return response.status;
  }

  newKey(): string {
    return randomUUID();
  }

  async counts(): Promise<DemoCountsInterface> {
    const user = String(this.userId);
    const [row] = await this.dataSource.query(
      `SELECT
         (SELECT count(*) FROM "Order" WHERE "userId" = $4)::int AS "orders",
         (SELECT count(*) FROM "OrderOutbox" WHERE "type" = $2 AND "payload"->>'userId' = $1)::int AS "outbox",
         (SELECT count(*) FROM "OrderOutbox" WHERE "type" = $2 AND "payload"->>'userId' = $1 AND "publishedAt" IS NOT NULL)::int AS "published",
         (SELECT count(*) FROM "OrderConfirmation" WHERE "userId" = $4)::int AS "effect",
         (SELECT count(*) FROM "OrderInbox" WHERE "consumer" = $3 AND "messageId" IN (SELECT "id" FROM "OrderOutbox" WHERE "type" = $2 AND "payload"->>'userId' = $1))::int AS "processed"`,
      [user, OrderCreatedEvent.TYPE, OrderInboxConsumerEnum.CONFIRMATION, this.userId],
    );
    return { ...row, deliveries: this.deliveries, applied: this.applied };
  }

  async waitFor(condition: (counts: DemoCountsInterface) => boolean, timeoutMs = 30000): Promise<DemoCountsInterface> {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const counts = await this.counts();
      if (condition(counts) || Date.now() > deadline) {
        return counts;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  async settle(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async stop(): Promise<void> {
    await Promise.race([this.app.close(), new Promise((resolve) => setTimeout(resolve, 10000))]);
  }
}

export function report(values: Record<string, number>, invariants: [string, boolean][]): number {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
  }

  const broken = invariants.filter(([, ok]) => !ok).map(([name]) => name);
  console.log(broken.length === 0 ? 'invariant=ok' : `invariant=broken: ${broken.join(', ')}`);
  return broken.length === 0 ? 0 : 1;
}

export async function run(scenario: (demo: Demo) => Promise<number>): Promise<void> {
  let code = 2;
  let demo: Demo | undefined;

  try {
    demo = await Demo.start();
    code = await scenario(demo);
  } catch (error) {
    console.error(error);
  } finally {
    await demo?.stop();
    process.exit(code);
  }
}
