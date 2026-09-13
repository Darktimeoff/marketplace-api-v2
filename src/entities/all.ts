import {
  BackgroundJob,
  Brand,
  BrandTranslation,
  Category,
  CategoryTranslation,
  DeliveryAddress,
  Identity,
  Phone,
  Product,
  ProductOffer,
  ProductTranslation,
  Transaction,
  User,
} from './index.js';

/**
 * Единственный список entities: используется и CLI-DataSource'ом для миграций
 * (`src/data-source.ts`), и рантайм-регистрацией TypeORM в Nest (`src/generic/db`).
 * Раньше список дублировался в обоих местах — теперь при добавлении entity
 * достаточно поправить один файл.
 */
export const entities = [
  Phone,
  DeliveryAddress,
  Identity,
  User,
  Brand,
  BrandTranslation,
  Category,
  CategoryTranslation,
  Product,
  ProductTranslation,
  ProductOffer,
  Transaction,
  BackgroundJob,
];
