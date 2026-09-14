import { DataSource } from 'typeorm';
import { runDemo, checkInvariant } from './demo/context.js';
import { ensureDemoBuyers, ensureDemoOffer, RACE_OFFER_SKU } from './demo/fixtures.js';
import { OrderService } from './order/service/order.service.js';
import { OrderCreateInput } from './order/input/order-create.input.js';
import { CountryCodeEnum, CurrencyEnum, ProductOffer } from './entities/index.js';
import { User } from './entities/user.entity.js';

const ATTEMPTS = 50;
const STOCK = 10;
const QUANTITY_PER_ATTEMPT = 1;
const BUYER_BALANCE = 1_000_000;

function buildInput(offer: ProductOffer, buyer: User, index: number): OrderCreateInput {
  return {
    recipient: {
      buyerId: buyer.id,
      fullName: `Race Buyer ${index}`,
      phone: {
        countryCode: CountryCodeEnum.UA,
        rawNumber: `0${800000000 + index}`,
        fullNumber: `+380${800000000 + index}`,
        nationalNumber: String(800000000 + index),
      },
      deliveryAddress: {
        addressLine: `Race street ${index}`,
        city: 'Kyiv',
        building: String(index),
      },
    },
    items: [{ productOfferId: offer.id, quantity: QUANTITY_PER_ATTEMPT }],
    currency: CurrencyEnum.UAH,
  };
}

await runDemo(async (app) => {
  const dataSource = app.get(DataSource);
  const orders = app.get(OrderService);

  const offer = await ensureDemoOffer(dataSource, RACE_OFFER_SKU, STOCK);
  const buyers = await ensureDemoBuyers(dataSource, ATTEMPTS, BUYER_BALANCE);

  const [{ maxOrderId }] = await dataSource.query<{ maxOrderId: number }[]>(
    `SELECT COALESCE(max(id), 0)::int AS "maxOrderId" FROM "Order"`,
  );
  const [{ maxTransactionId }] = await dataSource.query<{ maxTransactionId: number }[]>(
    `SELECT COALESCE(max(id), 0)::int AS "maxTransactionId" FROM "Transaction"`,
  );

  console.log(`Гонка за остатком: ${ATTEMPTS} параллельных checkout-ов`);
  console.log(`  товар: ProductOffer #${offer.id} (${RACE_OFFER_SKU}), остаток на старте ${STOCK}`);
  console.log(`  по ${QUANTITY_PER_ATTEMPT} шт. за вызов, баланс каждого покупателя ${BUYER_BALANCE}`);
  console.log('');

  const startedAt = Date.now();

  const outcomes = await Promise.allSettled(
    Array.from({ length: ATTEMPTS }, (_, index) =>
      orders.create(buildInput(offer, buyers[index], index + 1)),
    ),
  );

  const durationMs = Date.now() - startedAt;
  const succeeded = outcomes.filter((outcome) => outcome.status === 'fulfilled').length;
  const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');

  const reasons = new Map<string, number>();

  for (const outcome of rejected) {
    const error = outcome.reason as Error;
    const name = error?.constructor?.name ?? 'Error';
    reasons.set(name, (reasons.get(name) ?? 0) + 1);
  }

  const [{ quantity: finalStock }] = await dataSource.query<{ quantity: number }[]>(
    `SELECT "quantity" FROM "ProductOffer" WHERE "id" = $1`,
    [offer.id],
  );
  const [{ negative }] = await dataSource.query<{ negative: number }[]>(
    `SELECT count(*)::int AS negative FROM "ProductOffer" WHERE "quantity" < 0`,
  );
  const [{ createdOrders }] = await dataSource.query<{ createdOrders: number }[]>(
    `SELECT count(*)::int AS "createdOrders" FROM "Order" WHERE "id" > $1`,
    [maxOrderId],
  );
  const [{ createdPayments }] = await dataSource.query<{ createdPayments: number }[]>(
    `SELECT count(*)::int AS "createdPayments" FROM "Transaction"
      WHERE "id" > $1 AND "type" = 'PAYMENT'`,
    [maxTransactionId],
  );
  const [{ reserved }] = await dataSource.query<{ reserved: number }[]>(
    `SELECT COALESCE(sum(op."quantity"), 0)::int AS reserved
       FROM "OrderProduct" op
      WHERE op."productOfferId" = $1 AND op."orderId" > $2`,
    [offer.id, maxOrderId],
  );

  console.log(`  попыток:            ${ATTEMPTS}`);
  console.log(`  успешных:           ${succeeded}`);
  console.log(`  отказов:            ${rejected.length}  (${[...reasons].map(([name, count]) => `${name}×${count}`).join(', ') || '—'})`);
  console.log(`  финальный stock:    ${finalStock}`);
  console.log(`  строк с stock < 0:  ${negative}`);
  console.log(`  заказов создано:    ${createdOrders}`);
  console.log(`  списаний создано:   ${createdPayments}`);
  console.log(`  время:              ${durationMs} мс`);
  console.log('');
  console.log('Инварианты:');

  const expectedSuccesses = STOCK / QUANTITY_PER_ATTEMPT;

  const checks = [
    checkInvariant('попыток >= 50', ATTEMPTS >= 50, `${ATTEMPTS}`),
    checkInvariant(
      'успешных ровно столько, сколько было на складе',
      succeeded === expectedSuccesses,
      `${succeeded} (ожидалось ${expectedSuccesses})`,
    ),
    checkInvariant('финальный stock = 0', Number(finalStock) === 0, `${finalStock}`),
    checkInvariant('нет строк с отрицательным stock', Number(negative) === 0, `${negative}`),
    checkInvariant(
      'списанный со склада остаток равен сумме позиций в заказах',
      Number(reserved) === STOCK,
      `${reserved} шт. в позициях против ${STOCK} списанных`,
    ),
    checkInvariant(
      'нет заказов-сирот: заказов = успешных',
      Number(createdOrders) === succeeded,
      `${createdOrders} заказов на ${succeeded} успехов`,
    ),
    checkInvariant(
      'нет списаний-сирот: списаний = успешных',
      Number(createdPayments) === succeeded,
      `${createdPayments} списаний на ${succeeded} успехов`,
    ),
  ];

  const ok = checks.every(Boolean);

  console.log('');
  console.log(ok ? 'OVERSELL НЕ ПРОИЗОШЁЛ' : 'ИНВАРИАНТ НАРУШЕН — см. отметки выше');

  return ok;
});
