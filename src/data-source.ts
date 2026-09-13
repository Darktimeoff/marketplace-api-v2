import 'reflect-metadata';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataSource, DataSourceOptions } from 'typeorm';
import { entities as sharedEntities } from './entities/all.js';
import { Order } from './order/entity/order.entity.js';
import { OrderProduct } from './order/entity/order-product.entity.js';
import { OrderRecipient } from './order/entity/order-recipient.entity.js';

const here = dirname(fileURLToPath(import.meta.url));

// Order/OrderProduct/OrderRecipient зарегистрированы отдельно от src/entities/all.ts —
// они живут в src/order/entity/ вместе с остальным доменным модулем заказа
// (см. OrderModule). CLI-DataSource должен знать обо всех таблицах — иначе
// migration:generate не увидит их изменения.
const entities = [...sharedEntities, Order, OrderProduct, OrderRecipient];

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
 * обёртка scripts/with-secrets.sh из хранилища ДЗ #11.
 *
 * Имена переменных — те же, что уже используются в проекте с ДЗ #11: DBHOST/DBPORT/
 * DBUSER/DBNAME описаны в .env.example и zod-схеме, DBPASSWORD лежит в Infisical
 * (см. SecretsInterface). Отдельный набор DB_* здесь означал бы, что значения из
 * хранилища не подхватываются вообще.
 */
function connectionOptions(): DataSourceOptions {
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

  return {
    ...base,
    host: required('DBHOST'),
    port: Number(required('DBPORT')),
    // pg ждёт user, TypeORM — username; здесь именно username.
    username: required('DBUSER'),
    password: required('DBPASSWORD'),
    database: required('DBNAME'),
  } as DataSourceOptions;
}

export const AppDataSource = new DataSource(connectionOptions());
