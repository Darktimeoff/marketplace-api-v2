import 'reflect-metadata';
import { AppDataSource } from './data-source.js';
import { LanguageEnum, OrderProduct, StatusEnum } from './entities/index.js';

/**
 * Выторг по категориям: агрегат + GROUP BY + четыре JOIN'а через всю цепочку
 * OrderProduct -> ProductOffer -> Product -> Category -> CategoryTranslation.
 * Через find() это не выражается: find() возвращает сущности, а тут нужны
 * SUM/COUNT по группам, которых в модели нет ни одной сущностью.
 */
type RevenueRow = {
  categoryId: number;
  categorySlug: string;
  categoryName: string | null;
  orders: string;
  units: string;
  revenue: string;
};

// Статусы, по которым деньги считаются полученными.
const PAID_STATUSES = [StatusEnum.paid, StatusEnum.shipped, StatusEnum.delivered, StatusEnum.completed];

async function main(): Promise<void> {
  await AppDataSource.initialize();

  try {
    const rows = await AppDataSource.getRepository(OrderProduct)
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .innerJoin('item.productOffer', 'offer')
      .innerJoin('offer.product', 'product')
      .innerJoin('product.category', 'category')
      .leftJoin(
        'category.translations',
        'translation',
        'translation.language = :language',
        { language: LanguageEnum.en },
      )
      .where('order.status IN (:...statuses)', { statuses: PAID_STATUSES })
      .andWhere('order.deletedAt IS NULL')
      .andWhere('item.deletedAt IS NULL')
      .select('category.id', 'categoryId')
      .addSelect('category.slug', 'categorySlug')
      .addSelect('translation.name', 'categoryName')
      .addSelect('COUNT(DISTINCT order.id)', 'orders')
      .addSelect('SUM(item.quantity)', 'units')
      .addSelect('SUM(COALESCE(item.discountPrice, item.price) * item.quantity)', 'revenue')
      .groupBy('category.id')
      .addGroupBy('category.slug')
      .addGroupBy('translation.name')
      .orderBy('SUM(COALESCE(item.discountPrice, item.price) * item.quantity)', 'DESC')
      .getRawMany<RevenueRow>();

    if (rows.length === 0) {
      console.log('Данных нет — сначала выполни npm run seed.');
      return;
    }

    console.log('Выторг по категориям (оплаченные заказы)');
    console.log('');
    console.log('categoryId | slug        | name                 | orders | units | revenue');
    console.log('-----------+-------------+----------------------+--------+-------+----------');

    // Агрегаты приходят строками: COUNT — bigint, SUM(numeric) — numeric.
    // В number их не переводим, чтобы не терять точность на деньгах.
    let total = 0n;

    for (const row of rows) {
      console.log(
        [
          String(row.categoryId).padStart(10),
          (row.categorySlug ?? '').padEnd(11),
          (row.categoryName ?? '—').padEnd(20),
          String(row.orders).padStart(6),
          String(row.units).padStart(5),
          String(row.revenue).padStart(9),
        ].join(' | '),
      );

      total += BigInt(Math.round(Number(row.revenue) * 100));
    }

    console.log('');
    console.log(`Итого: ${(Number(total) / 100).toFixed(2)} по ${rows.length} категориям`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
