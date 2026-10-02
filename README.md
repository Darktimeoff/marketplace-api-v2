# marketplace-api-v2

Marketplace backend in NestJS, built as a modular monolith whose modules behave like separate services: each owns its data and its broker topology, and they talk to each other only through RabbitMQ messages described in shared contract packages.

| Service (module) | Owns | Talks over RabbitMQ |
|---|---|---|
| `order` | `Order`, `OrderRecipient`, `OrderLine` | sends `seller-offer.stock.reserve`, `account.customer.charge`, and the compensations `seller-offer.stock.release`, `account.customer.refund` |
| `seller-offer` | `SellerOffer`, `StockReservation` | answers `seller-offer.stock.reserve`, handles `seller-offer.stock.release` |
| `account` | `Account`, `Transaction`, `AccountInbox` | answers `account.customer.charge`, handles `account.customer.refund` |

The other modules (`product`, `product-variant`, `category`, `brand`, `seller`, `user`, `identity`) only own entities. Order reads offers from `seller-offer` for pricing.

## Bounded contexts

| Context | Owns |
|---|---|
| identity | `Identity`, with the login phone as a value object |
| user | `User`, `Address` |
| catalog | `Product`, `ProductTranslation`, `ProductVariant`, `Category`, `CategoryTranslation`, `Brand`, `BrandTranslation` |
| seller | `Seller`, `SellerOffer`, `StockReservation` |
| order | `Order`, `OrderRecipient`, `OrderLine` |
| account | `Account`, `Transaction`, `AccountInbox` |

```
identity ◄── user ◄──── order ───► seller ───► catalog
                          │
                          └──────► account
```

An arrow means "holds an id of". Every table belongs to one context, and a context could be moved into its own service without changing its model:

- **Plain ids across contexts, no foreign keys.** `User.identityId`, `Seller.userId`, `SellerOffer.variantId`, `Order.userId` and `OrderLine.offerId` are integers with no FK and no ORM relation, because a database constraint can't span two services. Foreign keys stay inside a context (`User → Address`, the catalog's own, `SellerOffer → Seller`, `StockReservation → SellerOffer`, `Order → OrderRecipient`, `OrderLine → Order`, `Transaction → Account`). The trade-off: the database no longer stops a reference to a deleted row in another context. Order validates offers at checkout, and order lines keep snapshot prices.
- **Snapshots, not shared rows.** `OrderRecipient` is the delivery contact as written at checkout: `fullName`, a phone and an address. It references nothing outside the order, so later edits to a user's profile don't rewrite past orders. It stays its own table, leaving room for per-seller shipments with their own recipient.
- **Value objects are embedded columns.** The recipient's phone and address and the identity's login phone are TypeORM embedded classes (`value-object/`), which give ordinary typed columns with their own CHECKs (`phoneFullNumber`, `addressCity`, `loginPhoneFullNumber`, …) rather than JSON or a shared `Phone` table.
- **Each context names things in its own language.** Order calls the buyer `userId`, account calls the same person `customerId`, and order maps one to the other when it sends `account.customer.charge` and `account.customer.refund`. `OrderLine` holds `unitPrice`/`unitDiscountPrice` at purchase time; `SellerOffer.onHandQuantity` is the physical stock next to `reservedQuantity`.
- **Contract packages hold only the published language**: what crosses a boundary (HTTP requests and responses, messages, and the enums those use). Entities, internal enums (`RoleEnum`, `TransactionTypeEnum`, `StockReservationStatusEnum`, …) and repository types stay inside their context.

`POST /order`:

```json
{
  "userId": 4,
  "recipient": {
    "fullName": "Jane Doe",
    "phone": { "countryCode": "UA", "rawNumber": "+380501234567", "fullNumber": "+380501234567", "nationalNumber": "0501234567" },
    "address": { "addressLine": "Khreshchatyk St, 1", "city": "Kyiv", "building": "1A" }
  },
  "items": [{ "offerId": 1, "quantity": 2 }],
  "currency": "UAH"
}
```

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
- Kafka is not used by the app yet. `docker compose up -d --wait kafka kafka-ui` starts a single KRaft node (broker and controller in one process) on `localhost:${KAFKA_PORT:-9092}` (containers reach it at `kafka:29092`) and Kafka UI on `localhost:${KAFKA_UI_PORT:-8090}`. Automatic topic creation is off: topics are declared explicitly, like the RabbitMQ exchanges, so a typo in a topic name fails instead of creating a new topic.
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

`SellerOffer.quantity` is stock on hand, `SellerOffer.reservedQuantity` is what active reservations hold, and **available = `quantity - reservedQuantity`**. `CHECK (0 <= reservedQuantity <= quantity)` guards it in the database.

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

- `@marketplace/contracts-core`: HTTP request/response interfaces and the enums they use (`OrderStatusEnum`, `CurrencyEnum`, `CountryCodeEnum`, `LanguageEnum`). Inputs and DTOs `implement` these interfaces; ORM entities implement nothing shared.
- `@marketplace/messaging-contracts`: `CloudEventInterface`, `TopicEnum` and one namespace per message (`TOPIC`, `TYPE`, `SOURCE`, `DataInterface`, `MessageType`, and for requests `RESPONSE_TYPE`, `ResponseMessageType`).

Packages export TypeScript sources for types (so `npx tsc --noEmit` works without building them) and `dist/` for Node. Mapping `TOPIC`/`TYPE` to an exchange and routing key happens only in the app's infrastructure.

## Auth (identity)

| Endpoint | Body | Result |
|---|---|---|
| `POST /auth/register` | `{ email?, phone?, password }`, at least one of email or phone | `201` token pair, `409` if the email or phone is taken |
| `POST /auth/login` | `{ login, password }`; a `login` starting with `+` is an E.164 phone, anything else an email | `200` token pair, `401` |
| `POST /auth/refresh` | `{ refreshToken }` | `200` new token pair, `401` |
| `POST /auth/logout` | `{ refreshToken }` | `204`, also for an unknown or already revoked token |

A token pair is `{ accessToken, refreshToken, tokenType: "Bearer", expiresIn }`.

- **Access token**: a 15-minute JWT signed with ES256. Claims: `sub` (identity id), `role`, `email`, `phone_number` (E.164), `iss: identity-service`, and a `kid` header (the public key's JWK thumbprint). Email and phone are in the token so other contexts don't have to ask identity for them on every request. A JWT is signed, not encrypted: anyone holding it can read these claims.
- **Asymmetric keys**: only identity reads `JWT_PRIVATE_KEY` and signs. Verifying needs only `JWT_PUBLIC_KEY`, so any service can check a token without being able to mint one. `AccessTokenGuard` (`src/generic/auth/`) accepts only ES256 from `identity-service`, which rules out `alg: none` and HS/RS key confusion, validates the payload with a zod schema, and puts `{ identityId, role, email, phoneNumber }` on the request. Today the public key comes from configuration; the next step towards zero trust is identity publishing it at `/.well-known/jwks.json` and verifiers fetching it from there.
- **Refresh token**: 32 random bytes, valid for 30 days, stored only as a SHA-256 hash in `IdentitySession`. Every refresh marks the token used and issues a new one in the same session family. The "not used yet" check is an `UPDATE … WHERE "usedAt" IS NULL RETURNING`, so two parallel refreshes can't both win. Presenting a used token again means it was copied, so the whole family is revoked. Logout revokes the family too. Each login starts a new family, so sessions on other devices are unaffected.
- **Passwords**: argon2id, 8–128 characters, no composition rules (NIST 800-63B). Login answers an unknown login, a wrong password and a deleted identity with the same `401 Invalid login or password`, and hashes a dummy password when the login doesn't exist, so timing doesn't reveal which accounts exist.
- **Registration** creates only the `Identity` (role `user`; a `role` in the body is ignored). The User profile isn't created, and `activatedAt` stays `NULL` until a verification flow exists.
- **Keys** live in Infisical (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, PEM). Generate a pair with `openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt` and `openssl ec -pubout`. Tests generate a fresh pair per run (`test/support/env.ts`).
- **Seeded logins**: `seller1@example.com`, `buyer1@example.com`, … with the password `marketplace-dev`.
- **Not done yet**: rate limiting on `/auth/*`, email/phone verification, the JWKS endpoint, cleanup of expired sessions, and a grace window for a client that refreshes twice in parallel (today the second request revokes the session).

## Realtime order status (SSE)

`PATCH /orders/:id/status` with `{ "userId": <buyerId>, "status": "preparing" }` changes a status; `GET /orders/:id/events?userId=<buyerId>` streams `order.status` events as SSE and replays events after `Last-Event-ID` (the most recent 100 per order). The buyer id is an ownership hint, not authentication.

SSE fits one-way notifications: the browser's `EventSource` reconnects by itself and sends `Last-Event-ID`. The history is process-local, so several app instances would need a shared pub/sub or event store behind the stream.

## Secrets

Secrets live in Infisical, not in env files. `scripts/with-secrets.sh <env> <command>` loads `.env` (non-secret settings) and runs the command under `infisical run`, which injects `DBPASSWORD`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD` (see `SecretsInterface`). Every npm script that needs the database goes through it. With `SKIP_VAULT=1` the wrapper runs the command directly and expects the values in the environment.

`npm run rotate:db-password` rotates the database password: it changes it in Postgres, writes `secrets/db_password.txt`, syncs Infisical and terminates the old sessions. With `SKIP_VAULT=1`, re-export `DBPASSWORD` afterwards.

## Database

- **Migrations only**: `synchronize: false`. `synchronize: true` would destroy what TypeORM doesn't model: the `uint` and `amount` domains, the `User.fullName` generated column and the `setUpdatedAt` triggers.
- **Generated migrations need review**: `migration:generate` also emits unrelated drift (FK renames to hash names, `User.fullName`, the `Order.publicId` default). Keep only the statements the change needs, and write a migration by hand when generation would recreate a table.
- **`onDelete`**: `CASCADE` for compositions that can't exist without their parent (translations, `OrderLine → Order`), `RESTRICT` everywhere else, including all money and order history.
- **Seed**: `npm run seed` is deterministic and idempotent; every row is looked up by a natural key before it is created, so running it twice gives the same database.

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
