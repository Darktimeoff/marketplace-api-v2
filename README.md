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

export DBHOST=127.0.0.1 DBPORT=33310 DBUSER=root DBPASSWORD=changeme DBNAME=api
export SKIP_VAULT=1    # у грейдера нет доступа к хранилищу

npm ci
npx tsc --noEmit
npm run build
npm run migrate
npm run migrate:show      # [X] InitSchema… [X] AddJobQueueProcessing…
npm run seed && npm run seed

# ДЗ #13
npm run demo:nplus1
npm run report

# ДЗ #14 — конкурентность (каждая команда завершается с кодом 0)
npm run demo:race
npm run demo:workers
npm run demo:retry

npm run migrate:revert && npm run migrate
```

`npm run build` обязателен перед любой из команд ниже: npm-скрипты запускают
скомпилированный `dist/`, а не исходники.

Все три демо-сценария ДЗ #14 самодостаточны — свои фикстуры (демо-товар с
остатком ровно 10, 50 покупателей с заведомо избыточным балансом, задачи в
очереди) они создают и сбрасывают сами, идемпотентно, поэтому повторный запуск
даёт тот же результат. `npm run seed` перед ними всё же нужен: без него в базе
нет каталога, на котором проверяются остальные ДЗ.

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
и берёт `src/data-source.ts` — ни хоста, ни пароля в коде нет.

Имена переменных — те же, что в проекте с ДЗ #11, а не выдуманные под это ДЗ:
`DBHOST`/`DBPORT`/`DBUSER`/`DBNAME` описаны в `.env.example` и zod-схеме, `DBPASSWORD`
лежит в хранилище (см. `SecretsInterface`). Отдельный набор вида `DB_*` означал бы, что
значения из хранилища не подхватываются вообще: `infisical run` подставляет `DBPASSWORD`,
и DataSource падал бы на «DB_PASSWORD is not set». Для грейдера предусмотрен
аварийный вход: при `SKIP_VAULT=1` обёртка сразу выполняет команду, считая, что значения
уже в окружении. Проверка `if` стоит **после** `shift`, иначе обёртка съела бы первый
аргумент и попыталась выполнить слово `dev` как команду (`exec: dev: not found`, exit 127).

### Ротация пароля и ORM

`npm run rotate:db-password` из ДЗ #11 работает без изменений и с TypeORM тоже. Что важно
понимать про разделение:

| Что | Где живёт | Кто подставляет |
|---|---|---|
| `DBHOST`, `DBPORT`, `DBNAME`, `DBUSER` | `.env` (несекретная конфигурация) | `scripts/with-secrets.sh` загружает `.env` |
| `DBPASSWORD` | Infisical | `infisical run` внутри той же обёртки |

Это тот же сплит, что и в приложении: `ConfigModule` читает `.env`, а `SecretManagerService`
ходит в хранилище. `infisical run` подставляет только секреты и пробрасывает родительское
окружение — `.env` он не читает, поэтому обёртка загружает его сама (уже выставленные
вручную переменные при этом не перетираются).

Как проходит ротация:

1. Скрипт берёт текущий `DBPASSWORD` из Infisical (файл `secrets/db_password.txt` — только fallback).
2. Делает `ALTER USER` на живой базе и пишет новый пароль в `secrets/db_password.txt`.
3. Синхронизирует новое значение обратно в Infisical.
4. Убивает оставшиеся сессии этой роли через `pg_terminate_backend`.

После этого **следующий `npm run migrate` или `npm run seed` подхватывает новый пароль сам**:
обёртка на каждый вызов заново тянет `DBPASSWORD` из хранилища. Пересоздание тома
(`docker compose down -v`) тоже остаётся согласованным — контейнер инициализируется из
`secrets/db_password.txt`, где уже лежит новый пароль.

Два момента, о которых стоит знать заранее:

- **`SKIP_VAULT=1` после ротации протухает.** В этом режиме значения задаёт тот, кто их
  экспортировал, и обновлять их надо руками: `export DBPASSWORD=$(cat secrets/db_password.txt)`.
- **DataSource получает пароль строкой один раз, при создании.** `DBService` из ДЗ #11
  передаёт в `pg` функцию (`password: () => secrets.get('DBPASSWORD')`), поэтому переживает
  ротацию сам — пул перечитывает пароль на каждое новое соединение. У TypeORM в конфиге
  статическая строка. Для коротких CLI-скриптов это неважно, но когда в ДЗ #14 TypeORM
  окажется внутри долгоживущего приложения, ротация потребует рестарта — либо надо будет
  пересоздавать DataSource по ошибке аутентификации.

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
   и прочих исходных из схемы ДЗ #12 (`marketplace.dbml`).

Всё это восстановлено вручную. На момент ДЗ #12/#13 схема сверялась машинно: `pg_dump
--schema-only` базы после миграции и базы, поднятой напрямую из raw-SQL схемы ДЗ #12, дали
**111 идентичных стейтментов**, расхождений ноль (тот raw-SQL файл был служебным
верификационным артефактом и убран из репозитория после проверки — дизайн схемы остаётся
в `marketplace.dbml`).

`down()` не заглушка: сносит все 14 таблиц, функцию, шесть enum-типов и оба домена.
Расширение `citext` остаётся намеренно — это общее свойство базы, его мог поставить не
только этот проект, а в `up()` оно создаётся через `IF NOT EXISTS`, так что повторный
`npm run migrate` проходит.

### Диф-миграция: quantity, Transaction, BackgroundJob

`src/migrations/1789306283697-AddQuantityTransactionsBackgroundJobs.ts` — второй пример
миграции, поверх `InitSchema`, а не с нуля: `ProductOffer` получает остаток `quantity`,
плюс две новые таблицы — `Transaction` (денежные проводки пользователя) и `BackgroundJob`
(очередь фоновых задач, пока только тип `ORDER`).

Тоже получена через `migration:generate` и тоже урезана руками — по той же причине, что и
`InitSchema`: генератор не узнал свои же старые имена FK (`Xxx_fkey`) в живой базе и выдал
`DROP`+`ADD` на все 17 существующих внешних ключей, ни один из которых не менялся, плюс
пересоздал `fullName` и дефолт `publicId` без единого содержательного изменения. Ниже — то,
что от диф-миграции реально осталось: одна `ALTER TABLE ADD COLUMN`, четыре `CREATE TYPE`,
две `CREATE TABLE`, два новых FK.

Решения по этому дифу (расходятся с исходным ДЗ, отмечены заранее в цепочке правок):

- **`quantity` — `integer`, не домен `amount`.** В черновике схемы колонка была типа
  `amount` (домен для денег), но это остаток товара на складе, а не деньги: `quantity=1.50`
  бессмысленно для штучного товара.
- **`quantity` — `CHECK (>= 0)`, не домен `uint`.** `uint` запрещает `0` (`CHECK VALUE > 0`),
  а распроданный оффер (`quantity = 0`) — нормальное состояние.
- **`quantity` физически последняя колонка.** `ALTER TABLE ADD COLUMN` всегда добавляет
  колонку в конец таблицы, а не туда, где она логически стоит в `CREATE TABLE` — это
  видно в `\d "ProductOffer"` и в `pg_dump`, поэтому в `marketplace.dbml` она тоже
  показана последней.
- **`BackgroundJob.dedupeKey` — `UNIQUE`.** Название поля говорит про дедупликацию — без
  ограничения это была бы просто ещё одна колонка, а дедуп пришлось бы делать вручную на
  каждый `INSERT`.
- **`BackgroundJob.payload` — `jsonb`, не `json`.** Единственная причина вообще выбирать
  между ними в Postgres: `jsonb` поддерживает индексацию и containment-запросы (`@>`).
- **`onDelete: 'RESTRICT'` у обоих новых FK** (`Transaction.userId → User`,
  `BackgroundJob.orderId → Order`) — та же политика, что и у остальных 13 FK в схеме:
  soft delete везде, физическое удаление аварийное, `RESTRICT` не даёт молча снести
  финансовую историю или задачи.
- **`Transaction.amount` — всегда неотрицательная величина** (домен `amount`, как и
  везде), направление денег кодирует `type` (`DEPOSIT`/`PAYMENT`/`WITHDRAWAL`), а не знак
  числа.

После применения обеих миграций `pg_dump --schema-only` на момент этой работы был снова
сверен с raw-SQL версией схемы: **126 идентичных стейтментов**, расхождений ноль. Откат
(`migrate:revert`) проверен дважды подряд до пустой базы (остаются только служебные таблицы
TypeORM) и обратно.

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
| `RESTRICT` | все остальные 15 FK (включая `Transaction.userId`, `BackgroundJob.orderId`) | В схеме везде soft delete, физическое удаление — аварийный сценарий, и `RESTRICT` не даст молча снести половину каталога |

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
естественному ключу (`slug`, `email`, `(sellerId, sku)`, `publicId`, `dedupeKey`) и
создаётся, только если её нет. Проверка:

```bash
npm run seed && npm run seed
docker compose exec -T db psql -U root -d api -Atc \
  'SELECT (SELECT count(*) FROM "Category") || \'/\' || (SELECT count(*) FROM "Product") || \'/\' ||
          (SELECT count(*) FROM "ProductOffer") || \'/\' || (SELECT count(*) FROM "Order") || \'/\' ||
          (SELECT count(*) FROM "OrderProduct") || \'/\' || (SELECT count(*) FROM "Transaction") || \'/\' ||
          (SELECT count(*) FROM "BackgroundJob")'
# 6/8/10/10/20/10/10 — одинаково после первого и после второго прогона
```

`Transaction` и `BackgroundJob` заводятся по одному на заказ: `Transaction` — снимок
оплаты (`status = SUCCESS`, если статус заказа уже в числе «оплачен/отгружен/доставлен/
завершён», иначе `PENDING`), `BackgroundJob` — задача обработки этого заказа с
`dedupeKey = order:<publicId>` — тем же ключом идемпотентности, что и у самого заказа.

### Файлы

| Файл | Назначение |
|---|---|
| `src/entities/` | 16 entities (14 из ДЗ #12 + `Transaction`, `BackgroundJob`) + enum-типы и transformer для денег |
| `src/migrations/` | `InitSchema` + диф-миграция (`quantity`, `Transaction`, `BackgroundJob`) |
| `src/data-source.ts` | DataSource: `synchronize: false`, параметры только из `process.env` |
| `src/seed.ts` | детерминированный идемпотентный seed |
| `src/demo-nplus1.ts` | демо N+1 «до/после» со счётчиком запросов |
| `src/query-count.logger.ts` | Logger, считающий отправленные в базу запросы |
| `src/report.ts` | отчёт через `createQueryBuilder().getRawMany()` |
| `scripts/with-secrets.sh` | обёртка «команда с секретами из хранилища» |

---

## Конкурентность (ДЗ #14)

Три сценария, каждый завершается с кодом 0 только если инварианты сошлись —
скрипты проверяют их сами, глазами сверять числа не нужно.

```bash
npm run demo:race      # 50 параллельных checkout-ов на товар с остатком 10
npm run demo:workers   # воркер-пул через FOR UPDATE SKIP LOCKED
npm run demo:retry     # повтор транзакции на 40001
```

### Числа из своих запусков

| Сценарий | Что мерилось | Результат |
|---|---|---|
| `demo:race` | попыток / успешных / финальный stock / строк с stock < 0 | **50 / 10 / 0 / 0**, 40 отказов `InsufficientStockException`, 111–330 мс |
| `demo:workers` | 24 задачи, 4 воркера, по 40 мс на задачу | распределение **6 / 6 / 6 / 6**, обработано дважды **0**, **297 мс** против 960 мс последовательно (×3.2) |
| `demo:workers` (чистая БД, в очереди ещё 12 задач из seed) | 36 задач, 4 воркера | **9 / 9 / 9 / 9**, дважды **0**, **402 мс** против 1440 мс (×3.6) |
| `demo:retry` | 5 конкурентных read-modify-write под REPEATABLE READ | **10 повторов**, все `40001`, финальное `quantity` = 5 = 0 + 5 × 1 |

`demo:race` устойчив к повторным запускам: фикстура каждый раз выставляет остаток
ровно в 10, поэтому «успешных 10» — это результат, а не совпадение. Отдельно
проверено, что скрипт ловит oversell, а не всегда печатает галочки: при снятой
проверке `quantity >= $n` (и снятом CHECK, который её дублирует на уровне БД)
тот же скрипт даёт **50 успешных, финальный stock −40, одну строку с
отрицательным остатком и exit 1**.

### Оптимистично-атомарный UPDATE против pessimistic FOR UPDATE

В checkout-е используются оба инструмента — на разных данных, и это не
непоследовательность, а следствие того, что данные разной формы.

**Остаток товара — атомарный `UPDATE … WHERE quantity >= $n RETURNING`**
(`src/product-offer/repository/product-offer.repository.ts`). Остаток — один
счётчик в одной колонке, и вся бизнес-проверка («хватает ли») выражается тем же
предикатом, что и защита от гонки. Раз так, проверять и списывать отдельными
операторами незачем: условие уезжает в `WHERE` того же `UPDATE`, окна между
проверкой и записью не остаётся физически, а ноль строк в `RETURNING` — это
готовый ответ «не хватило», для которого не нужен ни повторный `SELECT`, ни
доверие к прочитанному ранее значению. Дополнительный бонус — под
`READ COMMITTED` Postgres, упёршись в чужой лок строки, дожидается его снятия и
**перепроверяет `WHERE` на уже обновлённой версии строки**, так что второй
покупатель видит новый остаток, а не тот, что был на старте его транзакции.
`SELECT … FOR UPDATE` здесь дал бы тот же результат, но лишним раундтрипом и с
локом, взятым раньше, чем он нужен.

**Баланс покупателя — `SELECT … FOR UPDATE` по строке `User`**
(`src/account/repository/account.repository.ts`). Здесь одним атомарным `UPDATE`
не обойтись, потому что баланса как колонки не существует: он выводится
агрегатом по журналу проводок `Transaction`
(`SUM(DEPOSIT) − SUM(PAYMENT|WITHDRAWAL)` по успешным). Списание — это `INSERT`
новой проводки, и «хватает ли денег» — предикат не над изменяемой строкой, а над
набором строк, которого в момент вставки ещё нет. Такое условие в `WHERE`
вставки не положишь; сериализовать конкурентные списания одного пользователя
может только лок на чём-то одном, общем для них всех — на строке владельца
журнала.

Порядок захвата локов в `OrderService.create` фиксирован — сначала строки
`ProductOffer` по возрастанию `id`, потом строка `User`, — и встречного порядка
в коде нет ни у кого. Поэтому дедлок не «маловероятен», а невозможен по
построению. По той же причине резерв нескольких позиций идёт отдельными
`UPDATE` в порядке `id`, а не одним оператором на все строки: в одном операторе
порядок захвата локов выбирает планировщик, и два заказа с пересекающимися
позициями могут взять их в разном порядке — это `40P01` на ровном месте.

### Транзакционность checkout

Все четыре шага — резерв остатка, списание с баланса, `INSERT` заказа с
позициями, постановка задачи на post-processing — идут в **одной** транзакции
(`@Transactional()` на `OrderService.create`, `src/order/service/order.service.ts`).
Транзакция живёт на одном соединении из пула (`dataSource.transaction(...)`
внутри адаптера), а не раскидывается по `BEGIN`/`COMMIT` в разные соединения.

Проверок вида `if (offer.quantity >= item.quantity)` в JS в этом пути нет
намеренно: любая такая проверка — это окно между `SELECT` и `UPDATE`. Решение
принимает БД внутри самого `UPDATE`, код только читает, сколько строк вернулось.

Отсюда же «заказов-сирот не существует»: недостаток товара или денег бросает
исключение, транзакция откатывается целиком, и заказ, списание и задача исчезают
вместе. `demo:race` проверяет это не на слово — он сверяет, что создано ровно
столько заказов, сколько было успехов, столько же списаний, и что сумма позиций
в заказах совпадает со списанным со склада остатком.

Про пул соединений: 50 параллельных клиентов на пуле по умолчанию (10 соединений
у `pg`) — это 50 транзакций, вежливо стоящих в очереди пула. На результат это не
влияет, потому что узкое место всё равно строка товара: конкуренты за неё
сериализуются локом, а не пулом. Ни одному checkout-у не нужно второе соединение,
пока он держит первое, поэтому взаимной блокировки на пуле возникнуть не может.

### Воркер-пул и SKIP LOCKED

`claimNext` (`src/background-job/repository/background-job.repository.ts`) берёт
следующую задачу запросом `SELECT … FOR UPDATE SKIP LOCKED` — через
QueryBuilder это `setLock('pessimistic_write')` + `setOnLocked('skip_locked')`.
Без `SKIP LOCKED` второй воркер встал бы в очередь за первым на ту же строку и
пул из четырёх работал бы со скоростью одного.

Транзакция держится открытой **всё время обработки** задачи, а не закрывается
сразу после claim: лок снимается только на `COMMIT`, поэтому «упал воркер —
задачу подберёт другой» получается бесплатно. Если процесс умрёт на середине,
транзакция не закоммитится, лок исчезнет вместе с соединением, и задача вернётся
в `QUEUED` сама — без отдельного cron-а «отпусти зависшие». Статус `done` и
результат работы пишутся одним оператором и коммитятся вместе с самой работой,
так что разъехаться они не могут.

Пустой результат `SKIP LOCKED` означает «свободных нет **прямо сейчас**», а не
«очередь пуста»: оставшиеся строки могут быть просто залочены соседями. Поэтому
воркер на пустом ответе не выходит, а переспрашивает счётчик по статусам
(`countPending`) и останавливается, только если в `QUEUED` и `PROCESSING` не
осталось ничего (`src/background-job/worker/worker-pool.service.ts`).

«Ровно один раз» доказывает колонка `processedCount` **в самой строке задачи**, а
не счётчик в памяти скрипта: счётчик в памяти доказывал бы только то, что скрипт
умеет считать. `demo:workers` печатает `обработано дважды: 0` по результату
запроса `count(*) FILTER (WHERE "processedCount" > 1)`.

Тот же пул работает и как долгоживущий процесс: `npm run worker` (размер пула —
`WORKER_POOL_SIZE`). Несколько таких процессов можно запускать параллельно —
разводит их по разным задачам не код, а `SKIP LOCKED`.

### Почему retry ловит всего два кода

`DEADLOCK_ERROR_CODES = { '40P01', '40001' }`
(`src/generic/db/typeorm-retry.adapter.ts`). Это единственные два состояния, в
которых Postgres откатывает транзакцию, **заранее зная, что виновата не она
сама**, а чужая конкурентная транзакция: `40001` (`serialization_failure`) и
`40P01` (`deadlock_detected`). Тот же запрос на тех же данных, запущенный ещё
раз, имеет все шансы пройти — повтор здесь штатная часть протокола, а не «а вдруг
повезёт».

Всё остальное повторять бессмысленно или опасно:

- `23505`, `23503`, `23514` (нарушения unique / FK / CHECK) детерминированы —
  второй раз упадут ровно так же, повтор только удвоит нагрузку;
- `55P03` (`lock_not_available`), `57014` (`query_canceled`) означают, что ждать
  не разрешили; это решение вызывающего, а не сбой, и повтор его отменяет;
- ошибки соединения повторять вслепую нельзя вообще: транзакция могла
  закоммититься **до** обрыва, и повтор выполнит бизнес-операцию дважды.

Проверка идёт по SQLSTATE, а не по тексту сообщения и не по `instanceof`: текст
зависит от локали сервера, а класс ошибки у драйвера один на все сбои запроса.

Повторяется транзакция **целиком, вместе с чтениями**. Повтор одной записи по
значению, прочитанному в прошлой попытке, — это тот же lost update, только с
ретраем в стектрейсе: значение уже устарело. Backoff экспоненциальный и с
джиттером — без джиттера все проигравшие просыпаются одновременно и сталкиваются
снова.

`maxAttempts: 10` в `DBModule` выбрано не «с запасом»: под конкурентной нагрузкой
проигравшие выбывают по одной за раунд, и последней из пяти соперниц нужно
четыре повтора только чтобы дойти до своей очереди — что и видно в выводе
`demo:retry` (`повтор 4/9`). Если конфликта нет, лишние попытки ничего не стоят.

### Что появилось в схеме

Очередь задач (`BackgroundJob`) заведена ещё диф-миграцией ДЗ #13; ДЗ #14
добавляет к ней миграцией — не `synchronize` —
`src/migrations/1789405980915-AddJobQueueProcessing.ts`:

- `processedCount` (`integer NOT NULL DEFAULT 0` + `CHECK >= 0`) — счётчик
  доведённых до конца обработок в самой строке;
- `processedBy` (`varchar(64)`) — кто взял задачу: и распределение по воркерам в
  демо, и ответ на вопрос «на ком зависла задача в `PROCESSING`» в проде;
- частичный индекс `BackgroundJob_queue_idx (type, createdAt) WHERE status = 'QUEUED'`
  — ровно под claim-запрос: строки в других статусах воркеру не нужны никогда,
  поэтому partial index не тащит их в себе и не перестраивается, когда задача
  уходит в `READY`.

`migrate:revert` для этой миграции проверен и возвращает таблицу к состоянию ДЗ #13.

### Файлы ДЗ #14

| Файл | Назначение |
|---|---|
| `src/order/service/order.service.ts` | checkout в одной транзакции: резерв, списание, заказ, задача |
| `src/product-offer/repository/product-offer.repository.ts` | атомарный резерв остатка `UPDATE … WHERE quantity >= $n RETURNING` |
| `src/account/repository/account.repository.ts` | баланс по журналу проводок под `FOR UPDATE` на строке `User` |
| `src/background-job/repository/background-job.repository.ts` | claim через `FOR UPDATE SKIP LOCKED`, `processedCount` |
| `src/background-job/worker/worker-pool.service.ts` | пул воркеров, транзакция открыта на время обработки |
| `src/generic/db/typeorm-retry.adapter.ts` | повтор транзакции на `40001` / `40P01` с backoff, подключённый ко всем `@Transactional()` |
| `src/demo-race.ts`, `src/demo-workers.ts`, `src/demo-retry.ts` | три демо-сценария с самопроверкой инвариантов |
| `src/demo/fixtures.ts` | идемпотентные фикстуры: демо-товар с заданным остатком, покупатели с избыточным балансом |
| `src/worker.ts` | долгоживущий воркер-процесс (`npm run worker`) |
| `src/migrations/1789405980915-AddJobQueueProcessing.ts` | `processedCount`, `processedBy`, частичный индекс очереди |

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
npm run start:dev          # watch mode
npm run test               # unit tests (vitest)
npm run test:integration   # repository tests against a real Postgres (testcontainers)
npm run test:e2e           # e2e tests (full Nest app, supertest, real Postgres)
```

### Integration & e2e tests

`test:integration` and `test:e2e` each spin up a single `postgres:16-alpine`
container via `testcontainers`/`@testcontainers/postgresql` for the whole
suite run, apply the three migrations from `src/migrations/*.ts` directly
(no build step needed), then point the app at it via env vars + `SKIP_VAULT=1`
(`test/support/container-lifecycle.ts`, `test/support/env.ts`) — the same
mechanism the Grading recipe above uses.

**Isolation strategy: `TRUNCATE ... RESTART IDENTITY CASCADE` after every
test**, not a per-test transaction and not a container per test file:

- A wrapping-transaction-then-ROLLBACK strategy doesn't fit here — the app's
  own `@Transactional()` decorator (`@nestjs-cls/transactional`) opens its own
  real transaction per call, and `BackgroundJobRepository.claimNext` relies on
  row locks (`SKIP LOCKED`) that only make sense against committed rows. Both
  would behave differently, or deadlock, if forced to run nested inside an
  outer test transaction.
- A container per test file is correct but far more expensive: starting
  Postgres is the one real cost in this suite, and it buys no isolation that
  a table truncate doesn't already give.
- `TRUNCATE` after each test (`test/support/isolation.ts`) walks
  `pg_tables` generically and resets identities, so the suite is green on
  repeated runs with no manual cleanup, and it doesn't need updating when the
  schema grows.

Integration tests live in `test/integration/*.integration-spec.ts` and
exercise `BackgroundJobRepository` and `OrderRepository` directly (unique/FK
constraint violations, `claimNext`'s `SKIP LOCKED` behaviour, and
`findByIdOrFail`'s JOIN across `orderRecipient`/`items`). The e2e test in
`test/e2e/order.e2e-spec.ts` boots the real `AppModule` with no provider
overrides and drives `POST /order` → `GET /order/:id` over HTTP with
`supertest`, plus a `400` from the global `ValidationPipe` and a `404` for a
missing order. `test/support/builders.ts` has the test data builders
(`aUser`, `aProductOffer`, ...) used by both.

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
| `WORKER_POOL_SIZE` | no | `4` | Сколько воркеров поднимает `npm run worker` |

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
