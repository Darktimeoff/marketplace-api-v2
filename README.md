# marketplace-api-v2

Course project homework #1: OpenAPI contract for the Marketplace API
(`openapi/openapi.yaml`) + contract test part.

**Chosen contract-test option: A — consumer-driven Pact.**

---

## ORM: TypeORM (HW #13)

Схема из ДЗ #12 переехала в код: entities + relations + миграции, `synchronize` выключен.

### Grading

Свежий клон, чистая БД, без доступа к моему хранилищу секретов:

```bash
cp .env.example .env
cp secrets/db_password.txt.example secrets/db_password.txt
docker compose up -d --wait db

export DB_HOST=127.0.0.1 DB_PORT=33310 DB_USER=root DB_PASSWORD=changeme DB_NAME=api
export SKIP_VAULT=1    # у грейдера нет доступа к хранилищу

npm ci
npx tsc --noEmit
npm run build
npm run migrate
npm run migrate:show      # [X] InitSchema…
npm run seed && npm run seed
npm run demo:nplus1
npm run report
npm run migrate:revert && npm run migrate
```

Три уточнения к блоку выше, каждое — из реального падения, а не из осторожности:

- **`docker compose up -d --wait db`, а не без имени сервиса.** В compose кроме базы живёт
  стек Infisical из ДЗ #11; без явного `db` команда поднимала бы и его, а он требует
  недоступных грейдеру креденшелов.
- **Два `cp` в начале.** `.env` и `secrets/db_password.txt` лежат вне git с ДЗ #11.
  Шаблоны обоих в репозитории и содержат рабочие дев-значения, править их не нужно.
- **`--wait` обязателен.** Без него `docker compose up -d` возвращает управление,
  когда контейнер создан, но Postgres ещё не принимает соединений, и `npm run migrate`
  падает с `Connection terminated unexpectedly`.

### Как подключение приходит из хранилища

Все команды, ходящие в базу, обёрнуты в `scripts/with-secrets.sh` прямо внутри
npm-скриптов, так что префиксов набирать не нужно:

```json
"migrate": "bash scripts/with-secrets.sh dev npx typeorm migration:run -d dist/data-source.js",
"seed":    "bash scripts/with-secrets.sh dev node dist/seed.js"
```

Обёртка отдаёт значения из Infisical (окружения `dev` и `prod`) в `process.env`, откуда их
и берёт `src/data-source.ts` — ни хоста, ни пароля в коде нет. Для грейдера предусмотрен
аварийный вход: при `SKIP_VAULT=1` обёртка сразу выполняет команду, считая, что значения
уже в окружении. Проверка `if` стоит **после** `shift`, иначе обёртка съела бы первый
аргумент и попыталась выполнить слово `dev` как команду (`exec: dev: not found`, exit 127).

### synchronize

`synchronize: false` выставлен явно в `src/data-source.ts`. Здесь это не формальность:
`synchronize: true` снёс бы то, чего TypeORM не знает в метаданных — домены `uint` и
`amount`, generated-колонку `User."fullName"` и триггеры `updatedAt`.

### Миграция

`src/migrations/1788889879820-InitSchema.ts` получена через `migration:generate` и правлена
руками. Генератор сам:

1. четырежды выдавал `CREATE TYPE "LanguageEnum"` и дважды `"CurrencyEnum"` — по разу на
   каждую использующую таблицу, второй такой вызов падает с `42710`;
2. не создавал расширение `citext`, хотя `Identity."email"` объявлен как `citext`;
3. разворачивал домены `uint` и `amount` в голые `integer` и `numeric(12,2)`, теряя
   `CHECK (VALUE > 0)` и `CHECK (VALUE >= 0)` — замену `UNSIGNED` из ДЗ #12;
4. не знал про триггеры `…_setUpdatedAt` и функцию `setUpdatedAt`;
5. давал констрейнтам хешевые имена (`PK_faeb810…`) вместо `Phone_pkey`, `Identity_email_key`
   и прочих из `db/schema.sql`.

Всё это восстановлено вручную. Результат сверен машинно: `pg_dump --schema-only` базы после
миграции и базы после `db/schema.sql` дают **111 идентичных стейтментов**, расхождений ноль.

`down()` не заглушка: сносит все 14 таблиц, функцию, шесть enum-типов и оба домена.
Расширение `citext` остаётся намеренно — это общее свойство базы, его мог поставить не
только этот проект, а в `up()` оно создаётся через `IF NOT EXISTS`, так что повторный
`npm run migrate` проходит.

### Деньги: расхождение с заданием

Задание просит хранить деньги как `integer` в минорных единицах. В схеме ДЗ #12 они —
`numeric(12,2)` через домен `amount`, и схему это ДЗ по условию не меняет, поэтому тип
оставлен как есть. Плавающей точки при этом не возникает: `pg` отдаёт `numeric` строкой,
и в TypeScript оно строкой и остаётся (`src/entities/money.transformer.ts`) — перевод в
`number` сделал бы из точного десятичного значения `double`, то есть ровно ту ошибку,
от которой `numeric` и защищает.

### Relations и выбор onDelete

Все связи — через `@ManyToOne`/`@OneToMany`/`@OneToOne`. `OrderProduct` — явная
join-entity с составным PK, а не `@ManyToMany`: на связи висят данные (количество и
цены на момент заказа).

| Стратегия | Где | Почему |
|---|---|---|
| `CASCADE` | `BrandTranslation`, `CategoryTranslation`, `ProductTranslation` → родитель; `OrderProduct` → `Order` | Перевод без бренда/категории/товара и позиция без заказа не существуют как самостоятельные сущности |
| `RESTRICT` | все остальные 13 FK | В схеме везде soft delete, физическое удаление — аварийный сценарий, и `RESTRICT` не даст молча снести половину каталога |

Отдельно: `OrderProduct → ProductOffer` — именно `RESTRICT`, хотя рядом
`OrderProduct → Order` это `CASCADE`. Удаление оффера не должно вычищать позиции из уже
оформленных исторических заказов.

### N+1: до и после

`npm run demo:nplus1`. Граф `Order → OrderProduct → ProductOffer → Product` — три уровня связей.

| Стратегия | N=5 | N=10 | Растёт с N |
|---|---|---|---|
| наивно (запрос в цикле) | 26 | 51 | **да** |
| `relations` (JOIN) | 2 | 2 | нет |
| `relationLoadStrategy: 'query'` | 5 | 5 | нет |
| `leftJoinAndSelect` | 2 | 2 | нет |

Наивная стратегия даёт `1 + N + 2 × (позиции)` запросов, и при удвоении выборки число
удваивается — это и есть N+1, в коде он не виден, виден только в логе SQL (скрипт его
печатает построчно).

Про «2, а не 1» у JOIN-стратегий: в замере стоит `take`, а пагинация вместе с JOIN'ом
заставляет TypeORM сначала отдельным запросом выбрать id нужных заказов и только потом
джойнить — иначе `LIMIT` резал бы строки джойна, а не заказы. Без `take` это был бы
ровно 1 запрос. Важно, что число не зависит от N.

### Repository или QueryBuilder

Repository (`find`, `findOne`, `save`) — везде, где результат это сущности или их граф:
CRUD, выборка заказа с позициями, seed. QueryBuilder — там, где результат сущностью не
является: агрегаты, `GROUP BY`, оконные функции, наборы колонок из нескольких таблиц.
Граница простая: если ответ нельзя положить в entity без выдумывания полей — это
QueryBuilder с `getRawMany()`.

`npm run report` — выторг по категориям: `SUM(COALESCE(discountPrice, price) * quantity)`
с `GROUP BY` по категории и четырьмя JOIN'ами через `OrderProduct → ProductOffer →
Product → Category → CategoryTranslation`. Через `find()` это не выражается. Агрегаты
приходят строками (`COUNT` — bigint, `SUM(numeric)` — numeric) и в `number` не переводятся.

### Идемпотентность seed

`src/seed.ts` детерминирован: ни `random()`, ни `Date.now()`, каждая строка ищется по
естественному ключу (`slug`, `email`, `(sellerId, sku)`, `publicId`) и создаётся, только
если её нет. Проверка:

```bash
npm run seed && npm run seed
docker compose exec -T db psql -U root -d api -Atc \
  'SELECT (SELECT count(*) FROM "Category") || \'/\' || (SELECT count(*) FROM "Product") || \'/\' ||
          (SELECT count(*) FROM "ProductOffer") || \'/\' || (SELECT count(*) FROM "Order") || \'/\' ||
          (SELECT count(*) FROM "OrderProduct")'
# 6/8/10/10/20 — одинаково после первого и после второго прогона
```

### Файлы

| Файл | Назначение |
|---|---|
| `src/entities/` | 14 entities схемы ДЗ #12 + enum-типы и transformer для денег |
| `src/migrations/` | начальная миграция |
| `src/data-source.ts` | DataSource: `synchronize: false`, параметры только из `process.env` |
| `src/seed.ts` | детерминированный идемпотентный seed |
| `src/demo-nplus1.ts` | демо N+1 «до/после» со счётчиком запросов |
| `src/query-count.logger.ts` | Logger, считающий отправленные в базу запросы |
| `src/report.ts` | отчёт через `createQueryBuilder().getRawMany()` |
| `scripts/with-secrets.sh` | обёртка «команда с секретами из хранилища» |

---

## Database (HW #12)

Всё, что нужно грейдеру, — в этом разделе. Свежий клон, ничего доустанавливать не надо,
файлы править не надо. Нужен только Docker.

**Главная таблица — `"Order"`, 120 000 строк после сида.**

> ⚠️ Идентификаторы схемы в camelCase, поэтому в SQL они **всегда в двойных кавычках**:
> `SELECT count(*) FROM "Order";` — не `FROM Order`. Слово `order` вдобавок
> зарезервировано в SQL, без кавычек будет синтаксическая ошибка.

### Поднять Postgres — одна команда

```bash
cp .env.example .env && cp secrets/db_password.txt.example secrets/db_password.txt && docker compose up -d --wait db
```

Два `cp` в начале — потому что `.env` и `secrets/db_password.txt` в gitignore с ДЗ #11,
и в клоне их нет. Шаблоны обоих лежат в репозитории и содержат рабочие дев-значения,
править их не нужно. Без `.env` база поднимется как `postgres`/`postgres` на случайном
порту, и команды ниже не сработают.

> **Изменение в ДЗ #13.** Раньше `db/schema.sql` и `db/seed.sql` накатывались сами при
> первом старте контейнера через `/docker-entrypoint-initdb.d`. Начиная с ветки `hw-13`
> схему создаёт TypeORM-миграция, поэтому автонакат снят — иначе `npm run migrate`
> падал бы с `relation "Phone" already exists`. Таблицы, типы и констрейнты при этом
> не изменились: миграция даёт схему, идентичную `db/schema.sql` (сверено `pg_dump`).
> Прогон ниже по-прежнему работает и нужен для проверки ДЗ #12.

`db/schema.sql` идемпотентен (начинается с пересоздания схемы `public`), поэтому применять
его повторно на живой базе безопасно и он не падает с `already exists`.
`NOTICE: drop cascades to ...` в выводе — это не ошибка, а перечисление сносимых объектов.

### Подключиться — одна команда

```bash
docker compose exec db psql -U root -d api
```

Креденшелы стенда после этих `cp`: пользователь `root`, база `api`, порт хоста `33310`,
пароль `changeme`. Имя пользователя, базы и порт берутся из `.env`, пароль — из
`secrets/db_password.txt` через `POSTGRES_PASSWORD_FILE`.

Каталог `db/` смонтирован внутрь контейнера как `/db` (read-only), поэтому все `.sql`
доступны и снаружи (`db/schema.sql`), и изнутри (`/db/schema.sql`).

### Полный цикл: чистый volume → schema → seed → EXPLAIN до → indexes → EXPLAIN после

Каждая строка самодостаточна, копируется по одной или блоком целиком:

```bash
docker compose down -v db
docker compose up -d --wait db

docker compose exec -T db psql -U root -d api -v ON_ERROR_STOP=1 -f /db/schema.sql
docker compose exec -T db psql -U root -d api -v ON_ERROR_STOP=1 -f /db/seed.sql

# EXPLAIN «до» — в каждом плане есть Seq Scan
docker compose exec -T db psql -U root -d api -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q1.sql)"
docker compose exec -T db psql -U root -d api -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q2.sql)"
docker compose exec -T db psql -U root -d api -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q3.sql)"

docker compose exec -T db psql -U root -d api -v ON_ERROR_STOP=1 -f /db/indexes.sql
docker compose exec -T db psql -U root -d api -c "ANALYZE;"

# EXPLAIN «после» — Seq Scan нет, есть Bitmap Index Scan
docker compose exec -T db psql -U root -d api -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q1.sql)"
docker compose exec -T db psql -U root -d api -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q2.sql)"
docker compose exec -T db psql -U root -d api -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q3.sql)"
```

Сид отрабатывает примерно за 7 секунд. Разбор планов — в [`db/OPTIMIZATIONS.md`](db/OPTIMIZATIONS.md).

### Проверка критериев и ожидаемый вывод

```bash
# схема применилась, FOREIGN KEY >= 3
docker compose exec -T db psql -U root -d api -Atc "SELECT count(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY' AND table_schema='public';"
# -> 17

# объём главной таблицы >= 100000
docker compose exec -T db psql -U root -d api -Atc 'SELECT count(*) FROM "Order";'
# -> 120000

# partial или expression индекс присутствует >= 1
docker compose exec -T db psql -U root -d api -Atc "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND (indexdef ILIKE '% WHERE %' OR indexdef ~ '\((\w+)\(');"
# -> 2

# отчёт полный, >= 6
grep -c 'Execution Time' db/OPTIMIZATIONS.md
# -> 7

# база отвечает на свежем клоне
docker compose exec -T db psql -U root -d api -Atc "SELECT 1"
# -> 1
```

### Если удобнее psql с хоста, а не через контейнер

```bash
export PGPASSWORD=changeme
psql -h localhost -p 33310 -U root -d api -Atc "SELECT 1"
psql -h localhost -p 33310 -U root -d api -v ON_ERROR_STOP=1 -f db/schema.sql
psql -h localhost -p 33310 -U root -d api -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q1.sql)"
```

### Файлы

| Файл | Назначение |
|---|---|
| [`db/schema.sql`](db/schema.sql) | таблицы, типы, констрейнты (17 FOREIGN KEY). Индексов оптимизации намеренно нет — на этой схеме все три запроса дают `Seq Scan` |
| [`db/seed.sql`](db/seed.sql) | данные через `generate_series`, перекошенные распределения, `VACUUM (ANALYZE)` в конце |
| [`db/queries/q1.sql`](db/queries/q1.sql) | заказы покупателя за период |
| [`db/queries/q2.sql`](db/queries/q2.sql) | проблемные оплаты за 30 дней (`status = 'failed_payment'`) |
| [`db/queries/q3.sql`](db/queries/q3.sql) | поиск товара по названию без учёта регистра |
| [`db/indexes.sql`](db/indexes.sql) | три индекса: b-tree, **partial**, **expression** |
| [`db/OPTIMIZATIONS.md`](db/OPTIMIZATIONS.md) | `EXPLAIN (ANALYZE, BUFFERS)` до/после + разбор каждого плана |
| [`db/marketplace.dbml`](db/marketplace.dbml) | та же схема в DBML для dbdiagram.io |
| [`db/initdb/`](db/initdb) | обёртки автоната при первом старте контейнера: `01-schema.sql`, `02-seed.sql` |

### Решения по схеме

- **Деньги — `numeric(12,2)`**, не `float`. Через домен `amount` с `CHECK (VALUE >= 0)`.
- **Время — `timestamptz`** везде, кроме `dateOfBirth`: там `date`, потому что день рождения
  это календарная дата, а не момент времени.
- **Вместо `unsigned int`** (которого в Postgres нет) — домен `uint AS integer CHECK (VALUE > 0)`
  на всех FK и `quantity`. На PK его нет: `GENERATED ALWAYS AS IDENTITY` не принимает
  доменный тип и всё равно стартует с 1.
- **PK — `integer GENERATED ALWAYS AS IDENTITY`**, не `serial` (см. «Don't Do This»).
- **Снапшоты заказа**: `OrderRecipient` хранит копию получателя на момент заказа —
  новые строки `Phone` и `DeliveryAddress`, поэтому связи 1:1, а `Phone."fullNumber"`
  намеренно не уникален (снапшоты дублируют номер покупателя).

---

## Visualizing the spec

```bash
npm run spec:docs
```

Generates `docs.html` (Redoc) with interactive documentation — open it in a browser.

## Install

```bash
npm install
```

## Running the API (NestJS)

```bash
npm run start:dev   # watch mode
npm run test        # unit tests (vitest)
npm run test:e2e    # e2e tests
```

## Configuration

Environment variables are validated at startup with zod
(`src/generic/environment/environment.schema.ts`) — the app exits
immediately with a validation error if any are missing or invalid.

| Variable  | Required | Default | Description                          |
|-----------|----------|---------|---------------------------------------|
| `PORT`    | no       | `3000`  | HTTP port the Nest app listens on     |
| `DBHOST`  | yes      | —       | Postgres host                         |
| `DBPORT`  | no       | `3000`  | Postgres port (host-mapped, see `docker-compose.yml`) |
| `DBUSER`  | yes      | —       | Postgres role/user                    |
| `DBNAME`  | yes      | —       | Postgres database name                |

Секрет подключения к базе живёт **в хранилище секретов из ДЗ #11**, а не в env-файле:
пароль `DBPASSWORD` `SecretManagerService` читает из Infisical (окружения `dev` и
`prod`), остальные параметры подключения — обычные несекретные переменные выше.
Код подключения в ДЗ #12 не менялся.

Дев-креденшелы контейнера Postgres — отдельная история: они не секрет и лежат
дефолтами прямо в `docker-compose.yml`, чтобы база поднималась из свежего клона.

`.env.example` mirrors the schema and is checked against it in CI/locally:

```bash
npm run check:env   # fails with exit 1 if .env.example drifts from the schema
```

### Running locally

```bash
cp .env.example .env                        # fill in real values

docker compose up -d --wait db              # start Postgres (дефолты уже рабочие)
npm install
npm run start:dev                           # watch mode
```

### Rotating the database password

```bash
npm run rotate:db-password
```



This connects to Postgres with the current password from
`secrets/db_password.txt`, runs `ALTER USER ... PASSWORD`, writes the new
password back to that file (atomically), and terminates any other open
sessions for that role so nothing keeps running on the old credential. The
app itself needs no restart — `DBService` reads the password file fresh on
every new pool connection and has a `pool.on('error', ...)` handler so a
terminated idle connection is logged and replaced instead of crashing the
process.

## Checks (acceptance criteria)

```bash
# 1. Spec is valid (exit code 0, security-defined is satisfied via security: [])
npx @redocly/cli lint openapi/openapi.yaml

# 2. Spec size: >=2 resources, >=5 operations, Idempotency-Key required + description >=40 chars
npx @redocly/cli bundle openapi/openapi.yaml -o spec.json
node -e "const s=require('./spec.json'),M=['get','post','put','patch','delete'];\
const ops=Object.entries(s.paths).flatMap(([p,v])=>Object.keys(v).filter(m=>M.includes(m)).map(m=>[p,m]));\
const idem=ops.flatMap(([p,m])=>s.paths[p][m].parameters??[]).find(x=>x.in==='header'&&/idempotency-key/i.test(x.name));\
console.log('operations:',ops.length,'· resources:',new Set(Object.keys(s.paths).map(p=>p.split('/')[1])).size);\
console.log('Idempotency-Key: required =',idem?.required,'· description length =',(idem?.description??'').trim().length)"

# 3. Idempotency-Key is declared
grep -c 'Idempotency-Key' openapi/openapi.yaml

# 4. Cursor pagination is in the contract
grep -c 'nextCursor' openapi/openapi.yaml

# 5. problem+json is used for every error
grep -c 'application/problem+json' openapi/openapi.yaml

# 6. Contract test part (option A): the consumer test produces pacts/*.json
npm run test:contract
ls pacts/*.json
```

All commands pass right after `npm install`, with no extra manual steps.
