# marketplace-api-v2

Marketplace backend in NestJS, built as a modular monolith whose modules behave like separate services: each owns its data and its broker topology, and they talk to each other only through RabbitMQ messages described in shared contract packages.

| Service (module) | Owns | Talks over RabbitMQ |
|---|---|---|
| `order` | `Order`, `OrderRecipient`, `OrderProduct` | sends `seller-offer.stock.reserve`, `account.customer.charge`, and the compensations `seller-offer.stock.release`, `account.customer.refund` |
| `seller-offer` | `SellerOffer`, `StockReservation` | answers `seller-offer.stock.reserve`, handles `seller-offer.stock.release` |
| `account` | `Account`, `Transaction`, `AccountInbox` | answers `account.customer.charge`, handles `account.customer.refund` |

Catalog modules (`product`, `product-variant`, `category`, `brand`, `seller`, `user`, `identity`, `phone`, `delivery-address`) are plain HTTP/DB modules.

## Quick start

From a fresh clone, without access to the secret store:

```bash
cp .env.example .env
cp secrets/db_password.txt.example secrets/db_password.txt
cp secrets/rabbitmq_password.txt.example secrets/rabbitmq_password.txt
docker compose up -d --wait db db-bouncer rabbitmq

export DBHOST=127.0.0.1 DBPORT=33310 DBUSER=root DBPASSWORD=changeme DBNAME=api
export RABBITMQ_HOST=127.0.0.1 RABBITMQ_PORT=5672 RABBITMQ_USER=root RABBITMQ_PASSWORD=changeme
export SKIP_VAULT=1

npm ci
npm run build
npm run migrate
npm run seed
node dist/main.js
```

- `--wait` matters: without it `docker compose up -d` returns before Postgres and RabbitMQ accept connections, and `migrate` fails with `Connection terminated unexpectedly`. RabbitMQ's healthcheck is `rabbitmq-diagnostics -q check_running`.
- Postgres is reached through pgbouncer (`db-bouncer`), which is what `DBPORT` points at.
- Name the services explicitly: the compose file also contains the Infisical stack, which needs credentials of its own.
- `npm run build` is required before `migrate`, `seed` and starting the app: they run the compiled `dist/`. The build compiles the contract packages first, then the app.

## Architecture

### Module layout

```
src/<domain>/
  controller/      HTTP controllers (input → service/handler, @ResponseDto)
  gateway/         RabbitMQ adapters: @RabbitRPC / @RabbitSubscribe, envelope + payload validation, ack/nack
  command-handler/ one operation each, execute(), uses repositories directly
  service/         reusable domain logic and the <Domain>Topology service
  repository/      the only layer that touches TypeORM (TransactionHost per method)
  entity/          TypeORM entities; they implement contract interfaces
  enum/            names the module owns: queues, DLX, DLQ, inbox consumers
```

### Placing an order (saga)

`OrderPlaceCommandHandler.execute` runs placement as a saga instead of one database transaction, because stock and money live in other services:

1. **Commit the order as `pending_payment`** in its own short transaction (recipient, phone, address, order, items).
2. **Reserve stock**: RPC `seller-offer.stock.reserve`. Rejected → `422`, order `canceled`.
3. **Charge**: RPC `account.customer.charge`. Rejected → release the stock, `422`, order `failed_payment`.
4. **Mark `paid`.**

Any other failure after step 1 compensates whatever was already done: `account.customer.refund` if a charge was sent, `seller-offer.stock.release` if stock was reserved. The order is then marked `canceled` and the error is rethrown. No database connection is held while waiting for an RPC.

### Stock: on hand + reserved

`SellerOffer.quantity` is stock on hand, `SellerOffer.reservedQuantity` is what active reservations hold, and **available = `quantity - reservedQuantity`** (`GET /product/:id` reports available stock as `quantity`). `CHECK (0 <= reservedQuantity <= quantity)` guards it in the database.

Each reservation is a `StockReservation` row keyed by `(orderPublicId, offerId)` with a status (`reserved`, `confirmed`, `fulfilled`, `released`). Reserving inserts the row with `ON CONFLICT DO NOTHING` and, in the same statement, increments `reservedQuantity` only `WHERE quantity - "reservedQuantity" >= $n`. A redelivered request therefore holds stock once; releasing moves active rows to `released` and subtracts their quantity once.

### Money: balance + ledger

`Account(customerId, balance)` is the current balance; `Transaction` is the append-only ledger (`DEPOSIT`, `PAYMENT`, `WITHDRAWAL`, `REFUND`) with an FK to `Account`. Every movement writes both in one transaction. A charge is a single guarded statement, `UPDATE "Account" SET balance = balance - $2 WHERE "customerId" = $1 AND balance >= $2 RETURNING`, so two concurrent charges can never overdraw. The invariant is `Account.balance = SUM(ledger)` per customer; the seed recomputes accounts from the ledger.

Money is `numeric(12,2)` and stays a string in TypeScript (`moneyTransformer`): converting to `number` would turn an exact decimal into a `double`.

### Idempotency

Delivery over RabbitMQ is at-least-once, so every consumer makes its effect safe to repeat:

- **Natural key where the effect has one**: stock reservations (`(orderPublicId, offerId)`).
- **Per-service inbox where it doesn't**: account's `AccountInbox(consumer, messageId)`. `processOnce` inserts the row and runs the effect in the same transaction only if the row was new. A rejected charge rolls its row back, so a skipped duplicate is always a past success. A refund is applied only if the charge's inbox row exists. Inboxes are never shared between services.

### Messaging

- **CloudEvents 1.0, structured mode**: the whole event is the JSON body, content type `application/cloudevents+json`. The stable `id` is the dedup key.
- **Ownership**: an event belongs to its producer; a command or request belongs to its receiver (`seller-offer.stock.reserve` lives under `seller-offer/` in the contracts). A request with a reply is `XRequest` (`RESPONSE_TYPE` = `TYPE` + `.response`), a fire-and-forget instruction is `XCommand`.
- **Topology**: one topic exchange per owner (`seller-offer.commands`, `account.commands`, listed in `TopicEnum`). Each consumer names its own queue `<consumer>.<message>`, DLX `<consumer>.dlx`, DLQ `<queue>.dlq`, dead-letter routing key = queue name, all quorum queues. Each module's `…TopologyService` declares its DLX/DLQ and re-declares them on reconnect.
- **Publishing**: confirm channel, `persistent`, `mandatory`, plus a `return` listener that logs unroutable messages.
- **Consuming**: manual ack after the effect. A message that can never succeed (wrong `specversion`/`type`, invalid ids, invalid payload) is `Nack(false)` → DLQ with reason `rejected`; transient failures are retried.
- There is a single `RabbitMQModule.forRootAsync` (`src/generic/rabbitmq/rabbitmq.module.ts`); a second registration would silently share one connection with the wrong config.

### Contract packages

Two npm workspaces, transport-agnostic, with folders mirroring `src/<domain>/`:

- `@marketplace/contracts-core`: entity interfaces (`OrderEntityInterface`), request/response interfaces, domain enums (`OrderStatusEnum`, `CurrencyEnum`, `CountryCodeEnum`), `SerializedType<T>` (Date → ISO string). The app imports the enums from here, and ORM entities, inputs and DTOs `implements` these interfaces.
- `@marketplace/messaging-contracts`: `CloudEventInterface`, `TopicEnum` and one namespace per message (`TOPIC`, `TYPE`, `SOURCE`, `DataInterface`, `MessageType`, and for requests `RESPONSE_TYPE`, `ResponseMessageType`).

Packages export TypeScript sources for types (so `npx tsc --noEmit` works without building them) and `dist/` for Node. Mapping `TOPIC`/`TYPE` to an exchange and routing key happens only in the app's infrastructure.

## Realtime order status (SSE)

`PATCH /orders/:id/status` with `{ "userId": <buyerId>, "status": "preparing" }` changes a status; `GET /orders/:id/events?userId=<buyerId>` streams `order.status` events as SSE and replays events after `Last-Event-ID` (the most recent 100 per order). The buyer id is an ownership hint, not authentication.

SSE fits one-way notifications: the browser's `EventSource` reconnects by itself and sends `Last-Event-ID`. The history is process-local, so several app instances would need a shared pub/sub or event store behind the stream.

## Secrets

Secrets live in Infisical, not in env files. `scripts/with-secrets.sh <env> <command>` loads `.env` (non-secret settings) and runs the command under `infisical run`, which injects `DBPASSWORD`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD` (see `SecretsInterface`). Every npm script that needs the database goes through it. With `SKIP_VAULT=1` the wrapper runs the command directly and expects the values in the environment.

`npm run rotate:db-password` rotates the database password: it changes it in Postgres, writes `secrets/db_password.txt`, syncs Infisical and terminates the old sessions. With `SKIP_VAULT=1`, re-export `DBPASSWORD` afterwards.

## Database

- **Migrations only**: `synchronize: false`. `synchronize: true` would destroy what TypeORM doesn't model: the `uint` and `amount` domains, the `User.fullName` generated column and the `setUpdatedAt` triggers.
- **Generated migrations need review**: `migration:generate` also emits unrelated drift (FK renames to hash names, `User.fullName`, the `Order.publicId` default). Keep only the statements the change needs, and write a migration by hand when generation would recreate a table.
- **`onDelete`**: `CASCADE` for compositions that can't exist without their parent (translations, `OrderProduct → Order`), `RESTRICT` everywhere else, including all money and order history.
- **Seed**: `npm run seed` is deterministic and idempotent; every row is looked up by a natural key before it is created, so running it twice gives the same database.
- **Backups**: `npm run dump` writes a `pg_dump -Fc` backup; `npm run restore` restores the latest one into a throwaway container and checks one table's row count and column sum against the baseline recorded at dump time.

## Testing

```bash
npm test                  # unit tests
npm run test:integration  # repositories against Postgres (testcontainers)
npm run test:e2e          # the full app over HTTP (testcontainers)
```

Integration and e2e tests start their containers once per run and truncate all tables after every test (`test/support/isolation.ts`), because the app's own `@Transactional()` opens real transactions that a wrapping test transaction would interfere with.

## Configuration

Validated at startup with zod (`src/generic/environment/environment.schema.ts`); `npm run check:env` fails if `.env.example` drifts from the schema.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | no | `3000` | HTTP port |
| `DBHOST` | yes | — | Postgres (pgbouncer) host |
| `DBPORT` | no | `3000` | Postgres (pgbouncer) port |
| `DBUSER` | yes | — | Postgres user |
| `DBNAME` | yes | — | Postgres database |
| `RABBITMQ_HOST` | no | `rabbitmq` | broker host (`localhost` when the app runs outside Docker) |
| `RABBITMQ_PORT` | no | `5672` | AMQP port (`15672` is the management UI) |
| `INFISICAL_SITE_URL`, `INFISICAL_CLIENT_ID`, `INFISICAL_PROJECT_ID`, `INFISICAL_ENVIRONMENT` | yes | — | secret store access |

Secret values (`DBPASSWORD`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`) come from Infisical, or from the environment with `SKIP_VAULT=1`.
