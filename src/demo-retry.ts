import { DataSource } from 'typeorm';
import { TransactionHost } from '@nestjs-cls/transactional';
import { runDemo, checkInvariant } from './demo/context.js';
import { ensureDemoOffer, RETRY_OFFER_SKU } from './demo/fixtures.js';
import {
  onTransactionRetry,
  type TransactionalAdapterTypeOrmWithRetry,
  type TransactionRetryInfo,
} from './generic/db/typeorm-retry.adapter.js';
import { sleep } from './generic/util/sleep.util.js';

const CONCURRENCY = 5;
const INCREMENT = 1;
const THINK_MS = 40;

await runDemo(async (app) => {
  const dataSource = app.get(DataSource);
  const txHost = app.get<TransactionHost<TransactionalAdapterTypeOrmWithRetry>>(TransactionHost);

  const offer = await ensureDemoOffer(dataSource, RETRY_OFFER_SKU, 0);
  const initial = Number(offer.quantity);

  const retries: TransactionRetryInfo[] = [];
  const unsubscribe = onTransactionRetry((info) => retries.push(info));

  console.log('Повтор транзакции на serialization failure');
  console.log(`  строка:        ProductOffer #${offer.id} (${RETRY_OFFER_SKU}), quantity = ${initial}`);
  console.log(`  конкурентных read-modify-write: ${CONCURRENCY}, каждый +${INCREMENT}`);
  console.log(`  уровень изоляции: REPEATABLE READ`);
  console.log('');

  const startedAt = Date.now();

  try {
    await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        txHost.withTransaction({ isolationLevel: 'REPEATABLE READ' }, async () => {
          const [row] = await txHost.tx.query<{ quantity: number }[]>(
            `SELECT "quantity" FROM "ProductOffer" WHERE "id" = $1`,
            [offer.id],
          );

          await sleep(THINK_MS);

          await txHost.tx.query(`UPDATE "ProductOffer" SET "quantity" = $2 WHERE "id" = $1`, [
            offer.id,
            Number(row.quantity) + INCREMENT,
          ]);
        }),
      ),
    );
  } finally {
    unsubscribe();
  }

  const durationMs = Date.now() - startedAt;

  const [{ quantity: finalQuantity }] = await dataSource.query<{ quantity: number }[]>(
    `SELECT "quantity" FROM "ProductOffer" WHERE "id" = $1`,
    [offer.id],
  );

  const expected = initial + CONCURRENCY * INCREMENT;
  const byCode = new Map<string, number>();

  for (const info of retries) {
    byCode.set(info.code, (byCode.get(info.code) ?? 0) + 1);
  }

  console.log('Пойманные конфликты (каждый — откат и повтор транзакции целиком):');

  if (retries.length === 0) {
    console.log('  — ни одного');
  }

  for (const [index, info] of retries.entries()) {
    console.log(
      `  ${String(index + 1).padStart(2)}. SQLSTATE ${info.code}  повтор ${info.attempt}/${info.maxAttempts - 1}  backoff ${info.delayMs} мс`,
    );
    console.log(`      ${info.message.split('\n')[0]}`);
  }

  console.log('');
  console.log(`  повторов всего:   ${retries.length}  (${[...byCode].map(([code, count]) => `${code}×${count}`).join(', ') || '—'})`);
  console.log(`  время:            ${durationMs} мс`);
  console.log(`  quantity было:    ${initial}`);
  console.log(`  quantity стало:   ${finalQuantity}`);
  console.log(`  ожидалось:        ${expected} = ${initial} + ${CONCURRENCY} × ${INCREMENT}`);
  console.log('');
  console.log('Инварианты:');

  const onlyKnownCodes = [...byCode.keys()].every((code) => code === '40001' || code === '40P01');

  const checks = [
    checkInvariant(
      'поймано >= 1 конфликта сериализации',
      retries.length >= 1,
      `${retries.length}`,
    ),
    checkInvariant(
      'повторялись только 40001 / 40P01',
      onlyKnownCodes,
      [...byCode.keys()].join(', ') || '—',
    ),
    checkInvariant(
      'финальное состояние арифметически сходится',
      Number(finalQuantity) === expected,
      `${finalQuantity} = ${expected}`,
    ),
  ];

  const ok = checks.every(Boolean);

  console.log('');
  console.log(ok ? 'НИ ОДНОГО ПОТЕРЯННОГО АПДЕЙТА' : 'ИНВАРИАНТ НАРУШЕН — см. отметки выше');

  return ok;
});
