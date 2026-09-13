import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { AppDataSource } from './data-source.js';
import { QueryCountLogger } from './query-count.logger.js';
import { Order, OrderProduct, Product, ProductOffer } from './entities/index.js';

/**
 * Реальный для маркетплейса запрос: «список заказов покупателя вместе с позициями
 * и товарами». Граф связей: Order -> OrderProduct -> ProductOffer -> Product,
 * то есть три уровня.
 */
const logger = new QueryCountLogger();

const dataSource = new DataSource({
  ...AppDataSource.options,
  logging: ['query'],
  logger,
});

type Measured = { queries: number; orders: number; items: number };

async function measure(
  print: boolean,
  run: (ds: DataSource) => Promise<{ orders: number; items: number }>,
): Promise<Measured> {
  logger.reset(print);
  const { orders, items } = await run(dataSource);

  return { queries: logger.count, orders, items };
}

/** Наивно: запрос на каждый элемент в цикле — то, что и порождает N+1. */
async function naive(ds: DataSource, take: number) {
  const orders = await ds.getRepository(Order).find({ order: { id: 'ASC' }, take });
  let items = 0;

  for (const order of orders) {
    const orderItems = await ds.getRepository(OrderProduct).find({ where: { orderId: order.id } });

    for (const item of orderItems) {
      const offer = await ds
        .getRepository(ProductOffer)
        .findOne({ where: { id: item.productOfferId } });

      if (offer) {
        await ds.getRepository(Product).findOne({ where: { id: offer.productId } });
      }

      items += 1;
    }
  }

  return { orders: orders.length, items };
}

/** Фикс №1: relations — TypeORM собирает всё одним JOIN. */
async function withRelations(ds: DataSource, take: number) {
  const orders = await ds.getRepository(Order).find({
    order: { id: 'ASC' },
    take,
    relations: { items: { productOffer: { product: true } } },
  });

  return { orders: orders.length, items: orders.reduce((sum, o) => sum + o.items.length, 0) };
}

/** Фикс №2: relationLoadStrategy 'query' — по паре запросов на уровень связей. */
async function withQueryStrategy(ds: DataSource, take: number) {
  const orders = await ds.getRepository(Order).find({
    order: { id: 'ASC' },
    take,
    relationLoadStrategy: 'query',
    relations: { items: { productOffer: { product: true } } },
  });

  return { orders: orders.length, items: orders.reduce((sum, o) => sum + o.items.length, 0) };
}

/** Фикс №3: явный leftJoinAndSelect в QueryBuilder — тот же один запрос. */
async function withJoinAndSelect(ds: DataSource, take: number) {
  const orders = await ds
    .getRepository(Order)
    .createQueryBuilder('order')
    .leftJoinAndSelect('order.items', 'item')
    .leftJoinAndSelect('item.productOffer', 'offer')
    .leftJoinAndSelect('offer.product', 'product')
    .orderBy('order.id', 'ASC')
    .take(take)
    .getMany();

  return { orders: orders.length, items: orders.reduce((sum, o) => sum + o.items.length, 0) };
}

const STRATEGIES = [
  { name: 'наивно (запрос в цикле)', run: naive },
  { name: 'relations (JOIN)', run: withRelations },
  { name: "relationLoadStrategy: 'query'", run: withQueryStrategy },
  { name: 'leftJoinAndSelect', run: withJoinAndSelect },
];

async function main(): Promise<void> {
  await dataSource.initialize();

  try {
    console.log('N+1 демо. Граф: Order -> OrderProduct -> ProductOffer -> Product (3 уровня связей)');
    console.log('');
    console.log('SQL-лог наивной стратегии при N=5 — каждый лишний запрос виден построчно:');
    console.log('');

    await measure(true, (ds) => naive(ds, 5));

    console.log('');
    const results: Record<string, Record<number, Measured>> = {};

    for (const size of [5, 10]) {
      for (const strategy of STRATEGIES) {
        const measured = await measure(false, (ds) => strategy.run(ds, size));
        results[strategy.name] ??= {};
        results[strategy.name][size] = measured;
      }
    }

    const width = Math.max(...STRATEGIES.map((s) => s.name.length));
    console.log(`${'Стратегия'.padEnd(width)} | N=5 | N=10 | зависит от N`);
    console.log(`${'-'.repeat(width)}-+-----+------+-------------`);

    for (const strategy of STRATEGIES) {
      const five = results[strategy.name][5].queries;
      const ten = results[strategy.name][10].queries;
      const grows = five === ten ? 'нет' : 'ДА';

      console.log(
        `${strategy.name.padEnd(width)} | ${String(five).padStart(3)} | ${String(ten).padStart(4)} | ${grows}`,
      );
    }

    console.log('');
    const naiveTen = results[STRATEGIES[0].name][10];
    const fixedTen = results[STRATEGIES[1].name][10];
    console.log(
      `Итог: до — ${naiveTen.queries} запросов на ${naiveTen.orders} заказов ` +
        `и ${naiveTen.items} позиций; после — ${fixedTen.queries}.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
