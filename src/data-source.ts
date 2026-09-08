import 'reflect-metadata';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
  Brand,
  BrandTranslation,
  Category,
  CategoryTranslation,
  DeliveryAddress,
  Identity,
  Order,
  OrderProduct,
  OrderRecipient,
  Phone,
  Product,
  ProductOffer,
  ProductTranslation,
  User,
} from './entities/index.js';

const here = dirname(fileURLToPath(import.meta.url));

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
  OrderRecipient,
  Order,
  OrderProduct,
];

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not set. Параметры подключения приходят из хранилища секретов: ` +
        `запускай через "bash scripts/with-secrets.sh dev <команда>", ` +
        `либо выставь DB_* вручную и добавь SKIP_VAULT=1 (см. README, раздел Grading).`,
    );
  }

  return value;
}

/**
 * Никаких зашитых хостов и паролей: всё приходит из process.env, который наполняет
 * обёртка scripts/with-secrets.sh из хранилища ДЗ #11. Поддержаны обе формы —
 * одна строка DB_URL или отдельные DB_*.
 */
function connectionOptions(): DataSourceOptions {
  const url = process.env.DB_URL;

  const base = {
    type: 'postgres',
    entities,
    migrations: [join(here, 'migrations', '*.js')],
    migrationsTableName: 'migrations',
    // Схему создают только миграции. synchronize здесь не просто false —
    // его включение перетёрло бы домены, generated-колонку и триггеры из ДЗ #12,
    // которых TypeORM в метаданных не знает.
    synchronize: false,
    logging: false as const,
  } satisfies Partial<DataSourceOptions>;

  if (url) {
    return { ...base, url } as DataSourceOptions;
  }

  return {
    ...base,
    host: required('DB_HOST'),
    port: Number(required('DB_PORT')),
    // pg ждёт user, TypeORM — username; здесь именно username.
    username: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
  } as DataSourceOptions;
}

// Ровно один экспорт DataSource на файл: CLI миграций падает с
// "Given data source file must contain only one export of DataSource instance",
// если рядом лежит ещё и default-экспорт того же объекта.
export const AppDataSource = new DataSource(connectionOptions());
