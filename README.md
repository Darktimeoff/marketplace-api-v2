# marketplace-api-v2

Marketplace backend in NestJS, built as a modular monolith whose modules behave like separate services: each owns its data and its broker topology, and they talk to each other only through messages described in shared contract packages: commands and requests over RabbitMQ, domain events over Kafka.

| Service (module) | Owns | Talks over RabbitMQ |
|---|---|---|
| `order` | `Order`, `OrderRecipient`, `OrderLine` | runs the placement workflow on Temporal, which sends `seller-offer.stock.reserve`, `account.customer.charge`, and the compensations `seller-offer.stock.release`, `account.customer.refund` |
| `seller-offer` | `SellerOffer`, `StockReservation` | answers `seller-offer.stock.reserve` and `seller-offer.stock.release` |
| `account` | `Account`, `Transaction`, `AccountInbox` | answers `account.customer.charge` and `account.customer.refund` |

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
- **Public ids.** Every entity that something outside its context refers to has a `publicId uuid` (unique, `DEFAULT gen_random_uuid()`): `Identity`, `User`, `Address`, `Seller`, `SellerOffer`, `Product`, `ProductVariant`, `Category`, `Brand`, `Order`, `Transaction`. Children reached only through their parent (translations, `OrderRecipient`, `OrderLine`) and internal tables (`StockReservation`, `Account`, `AccountInbox`, `IdentitySession`) don't have one. The integer `id` stays the primary key and the FK target inside a context. Tokens and events already use `publicId`; HTTP routes, the RabbitMQ messages and the cross-context columns (`Order.userId`, `OrderLine.offerId`, …) still carry integer ids and move over one context at a time.
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
cp secrets/redis_password.txt.example secrets/redis_password.txt
docker compose up -d --wait db db-bouncer rabbitmq kafka temporal redis-cache redis-queue

export DBHOST=127.0.0.1 DBPORT=33310 DBUSER=root DBPASSWORD=changeme DBNAME=api
export RABBITMQ_HOST=127.0.0.1 RABBITMQ_PORT=5672 RABBITMQ_USER=root RABBITMQ_PASSWORD=changeme
export KAFKA_BROKERS=localhost:9092
export TEMPORAL_ADDRESS=localhost:7233
export REDIS_CACHE_URL=redis://default:changeme@localhost:6380 REDIS_QUEUE_URL=redis://default:changeme@localhost:6381
export JWT_PRIVATE_KEY="$(openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256)"
export JWT_PUBLIC_KEY="$(printf '%s' "$JWT_PRIVATE_KEY" | openssl pkey -pubout)"
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
- `kafka` is a single KRaft node (broker and controller in one process) on `localhost:${KAFKA_PORT:-9092}`; containers reach it at `kafka:29092`. Add `kafka-ui` to the command for Kafka UI on `localhost:${KAFKA_UI_PORT:-8090}`. Automatic topic creation is off: the app creates the topics it owns at startup, like the RabbitMQ exchanges, so a typo in a topic name fails instead of creating a new topic.
- `temporal` is the Temporal dev server (`temporal server start-dev`, SQLite in the `temporal_data` volume) on `localhost:${TEMPORAL_PORT:-7233}`, with its Web UI on `localhost:${TEMPORAL_UI_PORT:-8233}`: every placement workflow, its history, inputs, results and retries are visible there. The app doesn't start without it, like without Postgres, RabbitMQ or Kafka.
- `npm run build` is required before `migrate`, `seed` and starting the app: they run the compiled `dist/`. The build compiles the contract packages first, then the app.

## Architecture

### Module layout

```
src/<domain>/
  controller/      HTTP controllers (input → service/handler, @ResponseDto)
  gateway/         RabbitMQ adapters: @RabbitRPC / @RabbitSubscribe, envelope + payload validation, ack/nack
  command-handler/ one operation each, execute(), uses repositories directly
  workflow/        Temporal workflows (deterministic, no I/O) and their activity interface
  activity/        the workflow's activities, Nest providers that do the I/O
  worker/          the Temporal worker of the context's task queue
  service/         reusable domain logic and the <Domain>Topology service
  repository/      the only layer that touches TypeORM (TransactionHost per method)
  entity/          TypeORM entities; they implement contract interfaces
  enum/            names the module owns: queues, DLX, DLQ, inbox consumers
```

### Placing an order (Temporal workflow)

Placement is a saga, because stock and money live in other contexts. It runs as a Temporal workflow, so its progress survives a crash or a deploy: every finished step is recorded in Temporal's event history, and after a restart the worker replays the history and carries on from the next step instead of leaving the order stuck in `pending_payment`.

`POST /order` only creates the order. `OrderPlaceCommandHandler.execute` writes, in one transaction, the order as `pending_payment` (recipient, phone, address, lines), its `order.created` row in `OrderOutbox` and a row in `OrderWorkflowOutbox` asking to start `orderPlaceWorkflow` with the workflow id `order-place-<publicId>`. It answers `202` with the pending order; the client follows the outcome on the SSE stream or with `GET /order/:id`. An unknown offer or an invalid body is still a synchronous `404`/`400`, and nothing is written.

`POST /order` takes an optional `Idempotency-Key` header (a uuid, `400` otherwise), so a client can retry after a timeout or a lost response without placing a second order. The key identifies the intent, not the body: two identical bodies with different keys (or without one) are two legitimate orders, which a hash of the body would collapse into one. The key is stored on the order with a unique constraint on `(userId, idempotencyKey)`, so it is scoped to the buyer. The transaction starts by taking a transaction-scoped advisory lock on `(userId, key)` and looking the key up: if an order already has it, that order is returned with `202`, in whatever status it has reached, and nothing is written. The lock makes two concurrent requests with the same key run one after the other, so the second sees the first one's committed order instead of both seeing nothing and inserting; the unique constraint stays as the last guard. so one key gives one order, one `order.created` and one workflow.

The workflow is started through an outbox rather than by calling Temporal from the request, because the order and the start are writes to two systems: a call after the commit can fail (Temporal down, the pod killed by a deploy), leaving an order that nothing will ever pay or cancel. With the start in the same transaction as the order, there is never an order without its promise to be placed, and the API keeps accepting orders while Temporal is down. `OrderWorkflowOutboxRelayService` works like the other relays (every second, `FOR UPDATE SKIP LOCKED`, `attempts`/`lastError`, daily cleanup) and starts each row with a 10 s deadline. The workflow id is the idempotency key: the start uses `workflowIdConflictPolicy: USE_EXISTING` and `workflowIdReusePolicy: REJECT_DUPLICATE`, and an already-started error counts as started, so a start retried after a lost reply never runs a second workflow for the same order. Starting the workflow from the request with Update-With-Start (the workflow creating the order as its first step) was considered; it keeps order creation in the workflow's history, but makes `POST /order` fail whenever Temporal or the workers are down.

`orderPlaceWorkflow` (`src/order/workflow/`) runs on the task queue `order-place`:

1. **Reserve stock**: activity `reserveStock`, RPC `seller-offer.stock.reserve`. Rejected → order `canceled` (`insufficient_stock`).
2. **Charge**: activity `chargeCustomer`, RPC `account.customer.charge`. Rejected → release the stock, order `failed_payment` (`payment_rejected`).
3. **Mark `paid`**: activity `markPaid` writes the status and the `order.paid` outbox row in one transaction.

Any other failure after the stock was reserved compensates what may already have happened: `refundCustomer` (RPC `account.customer.refund`) if the charge was sent, then `releaseStock` (RPC `seller-offer.stock.release`), then `markFailed` (`canceled`, reason `error`). The compensations run in a non-cancellable scope, so cancelling the workflow can't interrupt them. A business rejection completes the workflow with the final status as its result; a technical failure fails it after compensating, so it shows up red in the Web UI.

The workflow only decides; every side effect is an activity (`OrderPlaceActivity`, `src/order/activity/`, a Nest provider with its dependencies). A step of the process is an activity; a fact about the order's own data is an outbox row written in the same transaction as the status. `OrderOutbox` therefore carries only Kafka events (`order.created`, `order.paid`, `order.failed`), sent by `OrderOutboxRelayService`, the same relay as identity's and user's. Activities are retried by Temporal, not by hand:

- `reserveStock` and `chargeCustomer`: 10 s per attempt, backoff 1 s → 10 s, at most 1 minute in total, then the workflow compensates. A rejection is thrown as a non-retryable `ApplicationFailure` with a type (`InsufficientStock`, `PaymentRejected`) that the workflow maps to the status and reason.
- `refundCustomer`, `releaseStock`, `markPaid`, `markFailed`: 10 s per attempt, retried until they succeed, because a compensation or a status must not be dropped.

Every activity is idempotent, because a timed-out attempt may have done its work before the retry: reserve and release are keyed by the order's `publicId` in `StockReservation`, the charge and the refund carry `id` = the order's `publicId`, which account's inbox deduplicates, and `markPaid`/`markFailed` only move an order out of `pending_payment` (`UPDATE … WHERE status = 'pending_payment'`), writing their event only when the row changed.

The compensations are request/reply like the forward steps, so an activity completes only when the receiver confirms. A fire-and-forget command would complete as soon as the broker took it, and a refund that then failed in account would end in a DLQ while the workflow reported success. A refund for a charge that never happened (the charge timed out before reaching account) answers `not_charged` instead of failing, so it is not retried forever. Every request is published with `expiration` equal to its 5 s RPC timeout: a request still queued when the caller has given up expires instead of running late (a reservation or a charge for an attempt nobody waits for). Expired requests are dead-lettered to the queue's DLQ with reason `expired` in `x-death`, so a backlog is visible there; a request already delivered to a consumer is processed regardless.

The worker (`OrderPlaceWorker`) runs inside the Nest app: it connects at bootstrap, bundles the workflow file into Temporal's isolated sandbox, and drains on shutdown, letting in-flight activities finish. The workflow file imports no Nest, TypeORM or broker code, only types and plain enums, because workflow code is replayed and must be deterministic. `TemporalClientService` (`src/generic/temporal/`) is the one client connection, shared like the Kafka client.

`order.paid` carries the main data of the order: `orderId`, `orderPublicId`, `userId`, `totalAmount`, `discountAmount`, `currency`, the `lines` (`offerId`, `quantity`, `unitPrice`, `unitDiscountPrice`) and `paidAt`. Its `id` is a fresh uuid written with the row, so it stays the same on every resend; the order's `publicId` is the subject, correlation id and Kafka key, so all events of one order stay ordered.

### Stock: on hand + reserved

`SellerOffer.quantity` is stock on hand, `SellerOffer.reservedQuantity` is what active reservations hold, and **available = `quantity - reservedQuantity`**. `CHECK (0 <= reservedQuantity <= quantity)` guards it in the database.

Each reservation is a `StockReservation` row keyed by `(orderPublicId, offerId)` with a status (`reserved`, `confirmed`, `fulfilled`, `released`). Reserving inserts the row with `ON CONFLICT DO NOTHING` and, in the same statement, increments `reservedQuantity` only `WHERE quantity - "reservedQuantity" >= $n`. A redelivered request therefore holds stock once; releasing moves active rows to `released` and subtracts their quantity once.

### Money: balance + ledger

`Account(customerId, balance)` is the current balance; `Transaction` is the append-only ledger (`DEPOSIT`, `PAYMENT`, `WITHDRAWAL`, `REFUND`) with an FK to `Account`. Every movement writes both in one transaction. A charge is a single guarded statement, `UPDATE "Account" SET balance = balance - $2 WHERE "customerId" = $1 AND balance >= $2 RETURNING`, so two concurrent charges can never overdraw. The invariant is `Account.balance = SUM(ledger)` per customer; the seed recomputes accounts from the ledger.

Money is `numeric(12,2)` and stays a string in TypeScript (`moneyTransformer`): converting to `number` would turn an exact decimal into a `double`.

### Idempotency

Delivery over RabbitMQ is at-least-once, so every consumer makes its effect safe to repeat:

- **Natural key where the effect has one**: stock reservations (`(orderPublicId, offerId)`).
- **Per-service inbox where it doesn't**: account's `AccountInbox(consumer, messageId)`. `processOnce` inserts the row and runs the effect in the same transaction only if the row was new. A rejected charge rolls its row back, so a skipped duplicate is always a past success. A refund is applied only if the charge's inbox row exists. A refund that finds none inserts that row itself and answers `not_charged`: a charge that timed out on the order side can still be sitting in the queue, and without the row it would be applied after the order was already compensated. The insert also serializes the two: whichever commits first wins, and the other sees the row. Inboxes are never shared between services.

### Messaging

- **CloudEvents 1.0, structured mode**: the whole event is the JSON body, content type `application/cloudevents+json`. The stable `id` is the dedup key.
- **Ownership**: an event belongs to its producer; a command or request belongs to its receiver (`seller-offer.stock.reserve` lives under `seller-offer/` in the contracts). A request with a reply is `XRequest` (`RESPONSE_TYPE` = `TYPE` + `.response`), a fire-and-forget instruction is `XCommand`.
- **Topology**: one topic exchange per owner (`seller-offer.commands`, `account.commands`, listed in `TopicEnum`). Each consumer names its own queue `<consumer>.<message>`, DLX `<consumer>.dlx`, DLQ `<queue>.dlq`, dead-letter routing key = queue name, all quorum queues. Each module's `…TopologyService` declares its DLX/DLQ and re-declares them on reconnect.
- **Publishing**: confirm channel, `persistent`, `mandatory`, plus a `return` listener that logs unroutable messages.
- **Consuming**: manual ack after the effect. A message that can never succeed (wrong `specversion`/`type`, invalid ids, invalid payload) is `Nack(false)` → DLQ with reason `rejected`; transient failures are retried.
- There is a single `RabbitMQModule.forRootAsync` (`src/generic/rabbitmq/rabbitmq.module.ts`); a second registration would silently share one connection with the wrong config.

### Events (Kafka)

RabbitMQ keeps the request/reply calls of the placement workflow: work for one receiver, acked or dead-lettered per message. Kafka carries domain events, facts that already happened, kept in a log that any number of consumers can read and replay at their own pace.

| Topic | Producer | Events | Consumer groups |
|---|---|---|---|
| `identity.events` (3 partitions, kept forever) | identity | `identity.registered` after a registration commits | `user.profile` |
| `user.events` (3 partitions, kept forever) | user | `user.created` after the user row commits | `account.provisioning` |
| `order.events` (3 partitions, kept forever) | order | `order.created` (committed as `pending_payment`), `order.paid`, `order.failed` (`canceled` / `failed_payment` with a `reason`) | `order.notify` (broadcast) |

Registration provisions the rest of the person asynchronously:

```
POST /auth/register ─► Identity ─► identity.registered ─► user.profile ─► User ─► user.created ─► account.provisioning ─► Account(balance 0)
```

Each step is owned by its context: identity never writes users, user never writes accounts. An account belongs to the user (`Account.customerId` = `User.id`, the id order charges), so account follows `user.created`, not `identity.registered`.

- **Same envelope**: a structured CloudEvent as the JSON value, headers `content-type: application/cloudevents+json` and `ce_type` (the event type, from the CloudEvents Kafka binding, so a consumer can skip types it doesn't handle without parsing the body). `id`, `subject` and `correlationid` are the aggregate's `publicId`, so `id` is stable for the fact and works as a consumer's dedup key.
- **Events carry the main data**, so a consumer never has to call back: `identity.registered` has `identityId`, `identityPublicId`, `email`, `phoneNumber`, `role`, `createdAt`; `user.created` has `userId`, `userPublicId`, `identityId`, `email`, `phoneNumber`, `firstName`, `lastName`, `language`, `createdAt`. Integer ids are included for now because the cross-context columns (`User.identityId`, `Account.customerId`) are still integers. `data` is built by hand, never the entity.
- **Key = `subject`**: all events about one identity land on the same partition and stay in order; different identities spread across partitions.
- **Topics**: `TopicEnum` lists every topic name regardless of broker. `RabbitMqModule` declares only the command exchanges, and `KafkaProducerService` (`src/generic/kafka/`) creates the topics it owns at startup with the admin API (an existing topic is left as it is; replication factor `-1` takes the broker default).
- **Producer**: `@confluentinc/kafka-javascript` (librdkafka) with idempotence on and `acks: all`, so a retried send never writes a duplicate and a send succeeds only once every in-sync replica has it.
- **Transactional outbox (identity and user)**: no producer calls Kafka directly. Register inserts an `IdentityOutbox` row in the same transaction as the `Identity`, and user inserts a `UserOutbox` row in the same transaction as the `User` (only when the user was actually inserted, so a redelivered `identity.registered` adds nothing). Each row has (`id` = the CloudEvent id, `topic`, `aggregateType`, `aggregateId` = the Kafka key, `type`, `payload` = the event's `data`). If the transaction rolls back, there is no event; if it commits, the event is guaranteed to be sent, even if Kafka is down or the process dies right after. Each context has its own copy of the table, repository and relay (`IdentityOutboxRelayService`, `UserOutboxRelayService`), like separate services. A relay runs every second: in one transaction it claims up to 100 unpublished rows oldest first with `FOR UPDATE SKIP LOCKED`, builds the CloudEvent from each row (`source` from `SourceEnum`, `time` = `createdAt`), sends them in order, and sets `publishedAt` on the sent rows. The first failure increments `attempts`, stores `lastError` and ends the batch, so later rows never overtake it; the next run retries. A send gives up after 10 s (`message.timeout.ms`), so an unreachable Kafka shows up as `lastError = Local: Message timed out` instead of a transaction held open. Delivery is at-least-once: a row sent but not yet marked published (crash, or a timed-out send that still arrived) is sent again with the same `id`, which consumers already deduplicate. A daily job in the `maintenance` queue (see Redis below) deletes published rows older than 7 days; Kafka keeps the events.
- **Several app instances**: `SKIP LOCKED` lets every instance run the relay without sending a row twice, but two instances can send two events of the same identity out of order. With one event per identity (`identity.registered`) that can't happen; a second identity event type should come with a single active relay (a Postgres advisory lock taken per run).
- **One topic per aggregate, not per event type**: Kafka orders messages only within a partition of one topic, so `identity.registered`, a later `identity.email-changed` and `identity.deleted` for the same identity must share a topic to reach consumers in that order. A stream gets its own topic only when its volume or retention differs (e.g. a per-login event).
- **Replay instead of losing skipped events**: a consumer commits its offset past events it skips, so a handler added later never sees them in that group. Instead each use case is its own consumer group (`user.profile`, later `user.email-sync`): a new group starts from the earliest offset and replays the whole topic. An existing group can also be rewound (`kafka-consumer-groups.sh --group <group> --reset-offsets --to-earliest --execute --topic identity.events` while it is stopped) and relies on its idempotency for the events it already handled. Either works only while the events still exist, which is why `identity.events` has `retention.ms=-1`.
- **Topic config is set at creation only**: the client can't read or alter configs, so a change to an existing topic (as for `retention.ms` on a Kafka created before it was added) is a one-off `kafka-configs.sh --entity-type topics --entity-name <topic> --alter --add-config <name>=<value>`.
- **Consumers** (`KafkaConsumerService`, `src/generic/kafka/`): a context's gateway registers `{ groupId, topic, handle }` (`src/user/gateway/user-identity-events.gateway.ts`, `src/account/gateway/account-user-events.gateway.ts`), and all consumers start once the app has bootstrapped. The gateway skips types it doesn't handle and validates the rest with a zod schema of the fields it needs.
- **Commit after the effect**: the offset is committed only after `handle` resolves. A thrown error redelivers the same message, so a transient failure (database restarting) retries until it succeeds. User's follow-up event goes through `UserOutbox` in the same transaction as the user, so once the user is committed `user.created` will be sent, and a redelivery neither inserts a second user nor writes a second event.
- **Idempotent by natural key**: `User.identityId` is unique and `Account.customerId` is the primary key; both inserts are `ON CONFLICT DO NOTHING`, so a redelivered or replayed event changes nothing.
- **Dead letters**: a message that can never succeed (not JSON, or failing the schema) is copied to `<group>.dlt` (`user.profile.dlt`, kept forever) with headers `dlt_reason` and `dlt_source` (`topic/partition@offset`), and the offset moves on, so one bad message doesn't block its partition.
- **`KAFKA_CONSUMERS_ENABLED=false`** runs the app without the consumers that write state (an API-only instance); broadcast consumers like `order.notify` still run, because they only feed in-memory SSE listeners and an API instance needs them. The tests turn it off everywhere except `registration-provisioning.e2e-spec.ts`, so background inserts can't land after a test truncates its tables.
- **Broadcast consumers** (`broadcast: true`): every app instance needs every event, so each instance joins its own group (`<group>.<random uuid>`), starts at the latest offset, commits nothing and has no dead-letter topic (a bad message is logged and skipped). A shared group would split the events between instances. Startup waits until the consumer has its partitions, so nothing published right after startup is missed.
- **Topics are ready before anyone subscribes**: `createTopics` waits until every partition of the new topics has a leader. Otherwise a consumer subscribing right after creation can miss the topic until the client's next metadata refresh (5 minutes by default).

### Contract packages

Two npm workspaces, transport-agnostic, with folders mirroring `src/<domain>/`:

- `@marketplace/contracts-core`: HTTP request/response interfaces and the enums they use (`OrderStatusEnum`, `CurrencyEnum`, `CountryCodeEnum`, `LanguageEnum`). Inputs and DTOs `implement` these interfaces; ORM entities implement nothing shared.
- `@marketplace/messaging-contracts`: `CloudEventInterface`, `TopicEnum`, `SourceEnum` (the CloudEvents `source` of each service, so `'/identity-service'` is written once) and one namespace per message (`TOPIC`, `TYPE`, `SOURCE`, `DataInterface`, `MessageType`, and for requests `RESPONSE_TYPE`, `ResponseMessageType`).

Packages export TypeScript sources for types (so `npx tsc --noEmit` works without building them) and `dist/` for Node. Mapping `TOPIC`/`TYPE` to an exchange and routing key happens only in the app's infrastructure.

## Redis: кеш, сесії, ліміти, черга

Redis makes the system faster, not more correct: everything below is an optimization or a convenience whose failure costs a database read, a login or a retry, never corrupted data. No business invariant (stock, balance, uniqueness) is guarded by Redis; those stay in Postgres.

**Two instances.** `maxmemory` and `maxmemory-policy` belong to the whole Redis process, and the two jobs need opposite settings: a cache must evict (`allkeys-lru`, 64 MB, no persistence), while BullMQ says it "cannot work properly if Redis evicts keys arbitrarily" and requires `noeviction`. `SELECT 1` doesn't separate them, so there are two containers: `redis-cache` (`allkeys-lru`, no RDB/AOF) and `redis-queue` (`noeviction`, `appendonly yes`, `appendfsync everysec`, 256 MB). Both run `redis:8.4.1-alpine` as the `redis` user with a password from `secrets/redis_password.txt`, written into a config file at start so it never shows up in the process arguments.

- **Cache-aside on `GET /order/:id`** (`redis-cache`). `@Cacheable` on `OrderService.findById` (a three-table read: order, lines, recipient) goes through `CacheService.getOrLoad`: a hit is served from Redis only, a miss reads Postgres and stores the JSON with a TTL of 300 s + `randomInt(0..60)`, so keys warmed together don't all expire in the same second. `@CacheEvict` on `markPaid`/`markFailed` deletes the key after the status transaction commits; the TTL is still always set, so a lost delete leaves stale data for at most 6 minutes. A 404 is not cached. The decorators only set metadata; `CacheExplorer` (`DiscoveryService`) wraps the marked methods at startup, outside `@Transactional`, which is why the delete happens after the commit.
- **Stampede lock.** On a miss, the first request takes `SET lock:<key> <uuid> NX PX 5000`; the others poll the key every 50 ms and return the value as soon as it appears. The owner releases only its own lock with `DELEX lock:<key> IFEQ <uuid>` (Redis 8.4), since a plain `DEL` after a slow read would delete the next owner's lock and let the stampede back in. If the owner fails, a waiter takes the lock; after 5 s a waiter reads the database itself instead of hanging.
- **Access token denylist** (`redis-queue`). Every access token carries `sid`, the session family its refresh-token chain belongs to (one per login). Logout and refresh-token reuse write `denied-family:<familyId>` with a TTL of the token lifetime plus clock tolerance (15 min + 5 s); `AccessTokenVerifierService` checks the signature, then `EXISTS denied-family:<sid>`, so every access token of that login stops working at once instead of at `exp`, while nothing at all is stored for live tokens. Denying the family rather than single `jti`s needs no index of issued tokens, and a token issued by a refresh that raced the logout carries the same `sid`, so it is denied too. The denylist is in `redis-queue`, not the cache: an evicted entry would bring a revoked token back to life. The JWT is self-contained and the denylist only answers "was this login revoked in the last 15 minutes", so a Redis outage doesn't have to stop authentication: with `ACCESS_DENYLIST_FAIL_OPEN=true` (the default) a check that fails, or doesn't answer within 300 ms, accepts the token on its signature and logs a warning; with `false` it answers `503`. The check fails at once while the connection is down instead of waiting in ioredis's offline queue, so an outage costs no latency. The price of fail-open is that tokens revoked shortly before or during the outage work again until their `exp`; a logout during the outage still revokes the refresh token in Postgres and answers `204`, but its denylist entry is lost, so that login's access tokens stay usable for at most 15 minutes. With `false`, a logout or reuse detection whose denylist entry can't be written answers `503` instead, so the client knows the revocation didn't take and can retry (the Postgres revocation is idempotent). The 300 ms timeout only covers a connected but slow Redis; it is long enough that ordinary latency spikes don't silently fail open. Idle tokens are not cut short: an access token lives until its 15-minute `exp`.
- **Login rate limit** (`redis-queue`). `POST /auth/login` allows 5 attempts per 60 s per `ip:login` (login trimmed and lowercased), through `@nestjs/throttler` with `RedisThrottlerStorage`: a sliding window in one Lua script (`ZREMRANGEBYSCORE` + `ZCARD` + `ZADD` + `PEXPIRE`, time from Redis `TIME` so pods agree). Login allows no burst, so the window is sliding rather than a token bucket, which would let up to 10 attempts through in the worst minute. Over the limit: `429` with `Retry-After` = seconds until the oldest attempt leaves the window. The counter lives in Redis, so every pod shares one limit; throttler's default storage is per process.
- **Queue** (`redis-queue`, `@nestjs/bullmq`). One queue, `maintenance`: `MaintenanceJobRegistryService` holds the handlers contexts register, `MaintenanceQueueService` only touches the queue (`upsertJobScheduler` on bootstrap, `enqueue(name, jobId)`), and `MaintenanceProcessor extends WorkerHost` only runs jobs (`concurrency: 1`, started after every context registered, `@OnWorkerEvent('failed' | 'stalled')`). Jobs get `attempts: 3`, `backoff: { type: 'exponential', delay: 1000, jitter: 0.5 }`, and `removeOnComplete` as an age/count limit, never `true`, which would turn `jobId` dedup off. The four outbox cleanups (identity, user, order, order workflow) moved here from `@Cron`: `upsertJobScheduler` keeps one scheduler per name across restarts and pods, and each daily run is processed by one worker instead of every pod. A job with no handler fails at once with `UnrecoverableError`.

**If the stampede lock breaks.** If Redis loses the lock, the owner dies before releasing it or the 5 s wait runs out, several requests miss at once and each reads Postgres: N identical `SELECT`s instead of one, and the last `SET` wins with the same value. That costs a few database reads on one hot key for one moment; nothing is written, so nothing can end up inconsistent. That is why a lock is acceptable here: it protects a read that may be repeated, and every path where it fails degrades to the behaviour we had without it. The same `SET NX PX` guarding a write (one charge per order, one reservation per offer) would be wrong: a lock can expire under a slow owner, and two writers would both proceed. Those invariants are enforced in Postgres (`UPDATE … WHERE balance >= $n`, natural keys with `ON CONFLICT`), never with a Redis lock.

## Auth (identity)

| Endpoint | Body | Result |
|---|---|---|
| `POST /auth/register` | `{ email?, phone?, password }`, at least one of email or phone | `201` token pair, `409` if the email or phone is taken |
| `POST /auth/login` | `{ login, password }`; a `login` starting with `+` is an E.164 phone, anything else an email | `200` token pair, `401` |
| `POST /auth/refresh` | `{ refreshToken }` | `200` new token pair, `401` |
| `POST /auth/logout` | `{ refreshToken }` | `204`, also for an unknown or already revoked token |

A token pair is `{ accessToken, refreshToken, tokenType: "Bearer", expiresIn }`.

- **Access token**: a 15-minute JWT signed with ES256. Claims: `sub` (the identity's `publicId`, a uuid; the integer id never leaves identity), `role`, `email`, `phone_number` (E.164), `iss: identity-service`, and a `kid` header (the public key's JWK thumbprint). Email and phone are in the token so other contexts don't have to ask identity for them on every request. A JWT is signed, not encrypted: anyone holding it can read these claims.
- **Asymmetric keys**: only identity reads `JWT_PRIVATE_KEY` and signs. Verifying needs only `JWT_PUBLIC_KEY`, so any service can check a token without being able to mint one. `AccessTokenGuard` (`src/generic/auth/`) accepts only ES256 from `identity-service`, which rules out `alg: none` and HS/RS key confusion, validates the payload with a zod schema, rejects a token whose session family is on the denylist (see Redis), and puts `{ identityPublicId, tokenId, familyId, role, email, phoneNumber }` on the request (`tokenId` = `jti`, `familyId` = `sid`). Today the public key comes from configuration; the next step towards zero trust is identity publishing it at `/.well-known/jwks.json` and verifiers fetching it from there.
- **`@Identity()`** (`src/generic/auth/decorator/`) reads those claims in a handler: `@UseGuards(AccessTokenGuard) @Get() me(@Identity() identity: AccessTokenClaimsInterface)`, or `@Identity('identityPublicId') identityPublicId: string` for one field. Without the guard on the route it fails with 500 instead of silently returning `undefined`.
- **Refresh token**: 32 random bytes, valid for 30 days, stored only as a SHA-256 hash in `IdentitySession`. Every refresh marks the token used and issues a new one in the same session family. The "not used yet" check is an `UPDATE … WHERE "usedAt" IS NULL RETURNING`, so two parallel refreshes can't both win. Presenting a used token again means it was copied, so the whole family is revoked. Logout revokes the family too. Each login starts a new family, so sessions on other devices are unaffected. A refresh and a revocation of the same family are serialized by a transaction-scoped advisory lock on the `familyId`: without it, a logout running while a refresh commits would revoke the old row but not the new one, which its snapshot can't see, and the rotated token would stay valid for 30 days.
- **Passwords**: argon2id, 8–128 characters, no composition rules (NIST 800-63B). Login answers an unknown login, a wrong password and a deleted identity with the same `401 Invalid login or password`, and hashes a dummy password when the login doesn't exist, so timing doesn't reveal which accounts exist.
- **Registration** creates the `Identity` (role `user`; a `role` in the body is ignored), and the User and its account follow asynchronously through Kafka (see Events). The user starts with the identity's `email` and `phoneNumber` as contact details. `activatedAt` stays `NULL` until a verification flow exists.
- **Keys** live in Infisical (`JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, PEM). Generate a pair with `openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt` and `openssl ec -pubout`. Tests generate a fresh pair per run (`test/support/env.ts`).
- **Seeded logins**: `seller1@example.com`, `buyer1@example.com`, … with the password `marketplace-dev`.
- **Not done yet**: rate limiting on `/auth/*`, email/phone verification, the JWKS endpoint, cleanup of expired sessions, and a grace window for a client that refreshes twice in parallel (today the second request revokes the session).

## Realtime order status (SSE)

`GET /orders/:id/events?userId=<buyerId>` streams the order's status as SSE `order.status` events: `pending_payment`, then `paid`, or `canceled` / `failed_payment`. The buyer id is an ownership hint, not authentication.

The stream is fed from Kafka, not from the code that changes the status. Order writes `order.created`, `order.paid` and `order.failed` through `OrderOutbox` in the same transaction as each status change; `OrderNotifyEventsGateway` consumes `order.events` as a broadcast consumer on every instance and records each event in `OrderNotifyService`, which pushes it to that order's SSE listeners and keeps the last 100 per order. The SSE `id` is the Kafka offset + 1: all events of one order are on one partition (key = `publicId`), so ids only grow per order and are the same on every instance, and a reconnect with `Last-Event-ID` resumes correctly on any instance. Offset + 1 because the first message of a partition has offset 0, which `Last-Event-ID` would treat as "nothing seen yet". The history is in memory: it is rebuilt from new events after a restart, not from the past. A status reaches the stream about a second after the change (the outbox relay's poll interval). SSE fits one-way notifications: the browser's `EventSource` reconnects by itself and sends `Last-Event-ID`.

## Secrets

Secrets live in Infisical, not in env files. `scripts/with-secrets.sh <env> <command>` loads `.env` (non-secret settings) and runs the command under `infisical run`, which injects `DBPASSWORD`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `REDIS_CACHE_URL`, `REDIS_QUEUE_URL` (see `SecretsInterface`). The Redis URLs carry the password (`redis://default:<password>@host:port`), so they are secrets rather than settings; `npm run bootstrap:secrets` writes that password to `secrets/redis_password.txt` for compose, taking it from the URLs so it lives in one place. Every npm script that needs the database goes through it. With `SKIP_VAULT=1` the wrapper runs the command directly and expects the values in the environment.

`npm run rotate:db-password` rotates the database password: it changes it in Postgres, writes `secrets/db_password.txt`, syncs Infisical and terminates the old sessions. With `SKIP_VAULT=1`, re-export `DBPASSWORD` afterwards.

## Database

- **Migrations only**: `synchronize: false`. `synchronize: true` would destroy what TypeORM doesn't model: the `uint` and `amount` domains, the `User.fullName` generated column and the `setUpdatedAt` triggers.
- **Generated migrations need review**: `migration:generate` also emits unrelated drift (FK renames to hash names, `User.fullName`, and a `DROP DEFAULT` / `SET DEFAULT gen_random_uuid()` pair for every `publicId`). Keep only the statements the change needs, and write a migration by hand when generation would recreate a table.
- **`onDelete`**: `CASCADE` for compositions that can't exist without their parent (translations, `OrderLine → Order`), `RESTRICT` everywhere else, including all money and order history.
- **Seed**: `npm run seed` is deterministic and idempotent; every row is looked up by a natural key before it is created, so running it twice gives the same database.

## Testing

```bash
npm test                  # unit tests
npm run test:integration  # repositories, cache, rate limit and queue against real services (testcontainers)
npm run test:e2e          # the full app over HTTP (testcontainers)
```

Integration and e2e tests start their containers once per run (Postgres, RabbitMQ, Kafka, Temporal and two Redis instances with the same eviction settings as compose, so nothing depends on a running dev stack) and reset state after every test (`test/support/isolation.ts`: truncate all tables and `FLUSHALL` both Redis instances, since restarted identities would otherwise hit cache entries of the previous test), because the app's own `@Transactional()` opens real transactions that a wrapping test transaction would interfere with.

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
| `KAFKA_BROKERS` | no | `kafka:29092` | comma-separated Kafka bootstrap servers (`localhost:9092` when the app runs outside Docker) |
| `KAFKA_CONSUMERS_ENABLED` | no | `true` | `false` starts the app without Kafka consumers |
| `ACCESS_DENYLIST_FAIL_OPEN` | no | `true` | when the access-token denylist (Redis) is unavailable: `true` accepts tokens on their signature, `false` answers `503` |
| `TEMPORAL_ADDRESS` | no | `temporal:7233` | Temporal frontend (`localhost:7233` when the app runs outside Docker) |
| `TEMPORAL_NAMESPACE` | no | `default` | Temporal namespace of the order workflows |
| `INFISICAL_SITE_URL`, `INFISICAL_CLIENT_ID`, `INFISICAL_PROJECT_ID`, `INFISICAL_ENVIRONMENT` | yes | — | secret store access |

Secret values (`DBPASSWORD`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `REDIS_CACHE_URL`, `REDIS_QUEUE_URL`) come from Infisical, or from the environment with `SKIP_VAULT=1`.
