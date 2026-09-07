# marketplace-api-v2

Course project homework #1: OpenAPI contract for the Marketplace API
(`openapi/openapi.yaml`) + contract test part.

**Chosen contract-test option: A — consumer-driven Pact.**

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
cp secrets/db_password.txt.example secrets/db_password.txt && docker compose up -d --wait db
```

Пароль базы читается из `secrets/db_password.txt` через `POSTGRES_PASSWORD_FILE` — файл
в gitignore с ДЗ #11, поэтому в клоне его нет и его надо создать из шаблона. Это первая
половина команды выше; в шаблоне лежит `changeme`.

Эта команда поднимает базу **уже со схемой и данными**: `db/schema.sql` и `db/seed.sql`
накатываются автоматически при первом старте пустого volume (через
`/docker-entrypoint-initdb.d`). Занимает около 7 секунд, и `--wait` дожидается конца
сида, а не только старта сервера. После неё можно сразу делать `EXPLAIN` — индексов
оптимизации в базе на этот момент ещё нет, они лежат отдельно в `db/indexes.sql`.

Ручной прогон из блока «Полный цикл» ниже при этом остаётся рабочим: `db/schema.sql`
идемпотентен (начинается с пересоздания схемы `public`), поэтому применять его повторно
на живой базе безопасно и он не падает с `already exists`. `NOTICE: drop cascades to ...`
в выводе — это не ошибка, а перечисление сносимых объектов.

### Подключиться — одна команда

```bash
docker compose exec db psql -U root -d api
```

Креденшелы стенда: пользователь `root`, база `api`, порт хоста `5500`, пароль — содержимое
`secrets/db_password.txt` (`changeme`, если скопирован из шаблона). Имя пользователя, базы
и порт заданы дефолтами в `docker-compose.yml`; локальный `.env`, если он есть, их
переопределяет.

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
psql -h localhost -p 5500 -U root -d api -Atc "SELECT 1"
psql -h localhost -p 5500 -U root -d api -v ON_ERROR_STOP=1 -f db/schema.sql
psql -h localhost -p 5500 -U root -d api -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q1.sql)"
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
