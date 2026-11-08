# marketplace-api-v2

Marketplace backend in NestJS, built as a modular monolith whose modules behave like separate services: each owns its data, and they talk to each other only through contracts described in shared packages: synchronous calls through ports (`client/`, an in-process adapter now and gRPC once a context moves out) and domain events over Kafka.

| Service (module) | Owns | Calls between services |
|---|---|---|
| `order` | `Order`, `OrderRecipient`, `OrderLine` | runs the placement workflow on Temporal; its activities call `SellerOfferClientInterface` (`findPrices`, `reserveStock`, `releaseStock`) and `AccountClientInterface` (`charge`, `refund`) |
| `seller-offer` | `SellerOffer`, `StockReservation` | answers `SellerOfferPriceRpc`, `StockReserveRpc`, `StockReleaseRpc` |
| `account` | `Account`, `Transaction`, `AccountInbox` | answers `AccountCustomerChargeRpc`, `AccountCustomerRefundRpc` |

Product calls media the same way (`MediaClientInterface`, `MediaClaimRpc`). The other modules (`product-variant`, `category`, `brand`, `seller`, `user`, `identity`) only own entities and talk through Kafka events.

## Bounded contexts

| Context | Owns |
|---|---|
| identity | `Identity`, with the login phone as a value object |
| user | `User`, `Address` |
| catalog | `Product`, `ProductTranslation`, `ProductMedia`, `ProductVariant`, `Category`, `CategoryTranslation`, `Brand`, `BrandTranslation` |
| seller | `Seller`, `SellerOffer`, `StockReservation` |
| order | `Order`, `OrderRecipient`, `OrderLine` |
| account | `Account`, `Transaction`, `AccountInbox` |
| media | `Media` (the bytes live in object storage, the list of files lives here) |

```
identity ◄── user ◄──── order ───► seller ───► catalog
                          │
                          └──────► account
```

An arrow means "holds an id of". Every table belongs to one context, and a context could be moved into its own service without changing its model:

- **Public ids across contexts, no foreign keys.** A reference to another context is the other row's `publicId` (`SellerOffer.variantPublicId`, `OrderLine.offerPublicId`, `ProductMedia.mediaPublicId`, `Seller.ownerPublicId`, `Media.ownerPublicId`), with no FK and no ORM relation, because a database constraint can't span two services. Foreign keys stay inside a context and point at the integer `id` (`User → Address`, the catalog's own, `SellerOffer → Seller`, `StockReservation → SellerOffer`, `Order → OrderBuyer`, `Order → OrderRecipient`, `OrderLine → Order`, `Transaction → Account`, `ProductMedia → Product`). The trade-off: the database no longer stops a reference to a deleted row in another context. Order validates offers at checkout, and order lines keep snapshot prices.
- **Snapshots, not shared rows.** `OrderRecipient` is the delivery contact as written at checkout: `fullName`, a phone and an address. It references nothing outside the order, so later edits to a user's profile don't rewrite past orders. It stays its own table, leaving room for per-seller shipments with their own recipient.
- **Value objects are embedded columns.** The recipient's phone and address and the identity's login phone are TypeORM embedded classes (`value-object/`), which give ordinary typed columns with their own CHECKs (`phoneFullNumber`, `addressCity`, `loginPhoneFullNumber`, …) rather than JSON or a shared `Phone` table.
- **Each context names things in its own language.** Order calls the person a buyer (`buyerPublicId`), account calls the same person a customer (`customerPublicId`), and order renames one to the other when it sends `account.customer.charge` and `account.customer.refund`. `OrderLine` holds `unitPrice`/`unitDiscountPrice` at purchase time; `SellerOffer.onHandQuantity` is the physical stock next to `reservedQuantity`.
- **`id` inside, `publicId` outside.** Every table but an association or an outbox has an integer `id` identity: the primary key and the FK target inside its context, never sent anywhere else. Entities something outside refers to also have a unique `publicId uuid`: `Identity`, `Address`, `Seller`, `SellerOffer`, `Product`, `ProductVariant`, `Category`, `Brand`, `Order`, `Transaction`, `Media` generate it. Children reached only through their parent (translations, `OrderRecipient`, `ProductMedia`, `IdentitySession`) have none; associations (`OrderLine`, `StockReservation`) are keyed by the pair they link; outboxes and inboxes by the message id. HTTP routes, events, RPC requests and workflow inputs carry only uuids.
- **A person has one uuid.** It is born as `Identity.publicId` and is the JWT `sub`. `User`, `Account` and `OrderBuyer` are each context's projection of that person, with their own `id` and the person's uuid as `publicId`, copied from events and never generated, so a projection is recognisable by a `publicId` without a default. Logs, events and tokens correlate one person across every context by that single value.
- **Contract packages hold only the published language**: what crosses a boundary (HTTP requests and responses, messages, and the enums those use). Entities, internal enums (`RoleEnum`, `TransactionTypeEnum`, `StockReservationStatusEnum`, …) and repository types stay inside their context.

`POST /order`:

```json
{
  "recipient": {
    "fullName": "Jane Doe",
    "phone": { "countryCode": "UA", "rawNumber": "+380501234567", "fullNumber": "+380501234567", "nationalNumber": "0501234567" },
    "address": { "addressLine": "Khreshchatyk St, 1", "city": "Kyiv", "building": "1A" }
  },
  "items": [{ "offerPublicId": "45b4b670-96f8-4cc3-9a2c-a9e284bb2551", "quantity": 2 }],
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
cp secrets/minio_root_password.txt.example secrets/minio_root_password.txt
cp secrets/storage_secret_key.txt.example secrets/storage_secret_key.txt
docker compose up -d --wait db db-bouncer rabbitmq kafka temporal redis-cache redis-queue minio minio-init edge

export DBHOST=127.0.0.1 DBPORT=33310 DBUSER=root DBPASSWORD=changeme DBNAME=api
export RABBITMQ_HOST=127.0.0.1 RABBITMQ_PORT=5672 RABBITMQ_USER=root RABBITMQ_PASSWORD=changeme
export KAFKA_BROKERS=localhost:9092
export TEMPORAL_ADDRESS=localhost:7233
export REDIS_CACHE_URL=redis://default:changeme@localhost:6380 REDIS_QUEUE_URL=redis://default:changeme@localhost:6381
export JWT_PRIVATE_KEY="$(openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256)"
export JWT_PUBLIC_KEY="$(printf '%s' "$JWT_PRIVATE_KEY" | openssl pkey -pubout)"
export REFRESH_TOKEN_PEPPER=local-pepper GOOGLE_CLIENT_SECRET=unused-locally
export STORAGE_ENDPOINT=http://localhost:9010 STORAGE_BUCKET=marketplace-media STORAGE_ACCESS_KEY=media-app STORAGE_SECRET_KEY=changeme-media
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
  client/          ports to other contexts and their adapters (in-process now, gRPC later)
  consumer/        Kafka consumers of other contexts' events
  command-handler/ one operation each, execute(), uses repositories directly
  workflow/        Temporal workflows (deterministic, no I/O) and their activity interface
  activity/        the workflow's activities, Nest providers that do the I/O
  worker/          the Temporal worker of the context's task queue
  service/         reusable domain logic
  repository/      the only layer that touches TypeORM (TransactionHost per method)
  entity/          TypeORM entities; they implement contract interfaces
  enum/            names the module owns: consumer groups, inbox consumers, task queues
```

### Placing an order (Temporal workflow)

Placement is a saga, because stock and money live in other contexts. It runs as a Temporal workflow, so its progress survives a crash or a deploy: every finished step is recorded in Temporal's event history, and after a restart the worker replays the history and carries on from the next step instead of leaving the order stuck in `pending_payment`.

`POST /order` only creates the order. `OrderPlaceCommandHandler.execute` writes, in one transaction, the order as `pending_payment` (recipient, phone, address, lines), its `order.created` row in `OrderOutbox` and a row in `OrderWorkflowOutbox` asking to start `orderPlaceWorkflow` with the workflow id `order-place-<publicId>`. It answers `202` with the pending order; the client follows the outcome on the SSE stream or with `GET /order/:id`. An unknown offer or an invalid body is still a synchronous `404`/`400`, and nothing is written.

`POST /order` takes an optional `Idempotency-Key` header (a uuid, `400` otherwise), so a client can retry after a timeout or a lost response without placing a second order. The key identifies the intent, not the body: two identical bodies with different keys (or without one) are two legitimate orders, which a hash of the body would collapse into one. The key is stored on the order with a unique constraint on `(buyerId, idempotencyKey)`, so it is scoped to the buyer. The transaction starts by taking a transaction-scoped advisory lock on `(buyerId, key)` and looking the key up: if an order already has it, that order is returned with `202`, in whatever status it has reached, and nothing is written. The lock makes two concurrent requests with the same key run one after the other, so the second sees the first one's committed order instead of both seeing nothing and inserting; the unique constraint stays as the last guard. so one key gives one order, one `order.created` and one workflow.

The workflow is started through an outbox rather than by calling Temporal from the request, because the order and the start are writes to two systems: a call after the commit can fail (Temporal down, the pod killed by a deploy), leaving an order that nothing will ever pay or cancel. With the start in the same transaction as the order, there is never an order without its promise to be placed, and the API keeps accepting orders while Temporal is down. `OrderWorkflowOutboxRelay` works like the other relays (every second, `FOR UPDATE SKIP LOCKED`, `attempts`/`lastError`, daily cleanup) and starts each row with a 10 s deadline. The workflow id is the idempotency key: the start uses `workflowIdConflictPolicy: USE_EXISTING` and `workflowIdReusePolicy: REJECT_DUPLICATE`, and an already-started error counts as started, so a start retried after a lost reply never runs a second workflow for the same order. Starting the workflow from the request with Update-With-Start (the workflow creating the order as its first step) was considered; it keeps order creation in the workflow's history, but makes `POST /order` fail whenever Temporal or the workers are down.

`orderPlaceWorkflow` (`src/order/workflow/`) runs on the task queue `order-place`:

1. **Reserve stock**: activity `reserveStock`, `SellerOfferClientInterface.reserveStock` (`StockReserveRpc`). Rejected → order `canceled` (`insufficient_stock`).
2. **Charge**: activity `chargeCustomer`, `AccountClientInterface.charge` (`AccountCustomerChargeRpc`). Rejected → release the stock, order `failed_payment` (`payment_rejected`).
3. **Mark `paid`**: activity `markPaid` writes the status and the `order.paid` outbox row in one transaction.

Any other failure after the stock was reserved compensates what may already have happened: `refundCustomer` (`AccountClientInterface.refund`) if the charge was sent, then `releaseStock` (`SellerOfferClientInterface.releaseStock`), then `markFailed` (`canceled`, reason `error`). The compensations run in a non-cancellable scope, so cancelling the workflow can't interrupt them. A business rejection completes the workflow with the final status as its result; a technical failure fails it after compensating, so it shows up red in the Web UI.

The workflow only decides; every side effect is an activity (`OrderPlaceActivity`, `src/order/activity/`, a Nest provider with its dependencies). A step of the process is an activity; a fact about the order's own data is an outbox row written in the same transaction as the status. `OrderOutbox` therefore carries only Kafka events (`order.created`, `order.paid`, `order.failed`), sent by `OrderOutboxRelay`, the same relay as identity's and user's. Activities are retried by Temporal, not by hand:

- `reserveStock` and `chargeCustomer`: 10 s per attempt, backoff 1 s → 10 s, at most 1 minute in total, then the workflow compensates. A rejection is thrown as a non-retryable `ApplicationFailure` with a type (`InsufficientStock`, `PaymentRejected`) that the workflow maps to the status and reason.
- `refundCustomer`, `releaseStock`, `markPaid`, `markFailed`: 10 s per attempt, retried until they succeed, because a compensation or a status must not be dropped.

Every activity is idempotent, because a timed-out attempt may have done its work before the retry: reserve and release are keyed by the order's `publicId` in `StockReservation`, the charge and the refund carry `chargeId` = the order's `publicId`, which account's inbox deduplicates, and `markPaid`/`markFailed` only move an order out of `pending_payment` (`UPDATE … WHERE status = 'pending_payment'`), writing their event only when the row changed.

Every call to another context goes through a port in `order/client/` and waits for its answer, compensations included, so an activity completes only when the receiver has applied (or refused) the step. The activity only decides what a rejection means; the adapter owns the transport. Today the adapters call the other context's command handler in-process (`SellerOfferStockReserveCommandHandler`, `AccountCustomerChargeCommandHandler`, …); once a context moves out, its adapter becomes a gRPC client and nothing else changes, which is why every request carries its own idempotency key (`chargeId`, `orderPublicId`) instead of relying on a message envelope. A refund for a charge that never happened answers `not_charged` instead of failing, so it is not retried forever. Temporal's per-attempt timeout bounds every call.

The workflow input carries only uuids (`orderPublicId`, `buyerPublicId`, `items[].offerPublicId`) and the total. Changing its shape breaks a workflow already running with the old input when it replays, so before such a deploy wait for running placements to finish (`temporal workflow list --query 'ExecutionStatus="Running"'`) or version the workflow with `patched()`.

The worker (`OrderPlaceWorker`) runs inside the Nest app: it connects at bootstrap, bundles the workflow file into Temporal's isolated sandbox, and drains on shutdown, letting in-flight activities finish. The workflow file imports no Nest, TypeORM or broker code, only types and plain enums, because workflow code is replayed and must be deterministic. `TemporalClientService` (`src/generic/temporal/`) is the one client connection, shared like the Kafka client.

`order.paid` carries the main data of the order: `orderPublicId`, `buyerPublicId`, `totalAmount`, `discountAmount`, `currency`, the `lines` (`offerPublicId`, `quantity`, `unitPrice`, `unitDiscountPrice`) and `paidAt`. Its `id` is a fresh uuid written with the row, so it stays the same on every resend; the order's `publicId` is the subject, correlation id and Kafka key, so all events of one order stay ordered.

### Stock: on hand + reserved

`SellerOffer.quantity` is stock on hand, `SellerOffer.reservedQuantity` is what active reservations hold, and **available = `quantity - reservedQuantity`**. `CHECK (0 <= reservedQuantity <= quantity)` guards it in the database.

Each reservation is a `StockReservation` row keyed by `(orderPublicId, offerId)` (the offer's own `id`: seller resolves the `offerPublicId` from the request inside its context) with a status (`reserved`, `confirmed`, `fulfilled`, `released`). Reserving inserts the row with `ON CONFLICT DO NOTHING` and, in the same statement, increments `reservedQuantity` only `WHERE quantity - "reservedQuantity" >= $n`. A redelivered request therefore holds stock once; releasing moves active rows to `released` and subtracts their quantity once.

### Money: balance + ledger

`Account(id, publicId, balance)` is the current balance of one person (`publicId` = the person's uuid); `Transaction` is the append-only ledger (`DEPOSIT`, `PAYMENT`, `WITHDRAWAL`, `REFUND`) with `accountId` as an FK to `Account.id`. Every movement writes both in one transaction. A charge is a single guarded statement, `UPDATE "Account" SET balance = balance - $2 WHERE "publicId" = $1 AND balance >= $2 RETURNING "id"`, so two concurrent charges can never overdraw. The invariant is `Account.balance = SUM(ledger)` per customer; the seed recomputes accounts from the ledger.

Money is `numeric(12,2)` and stays a string in TypeScript (`moneyTransformer`): converting to `number` would turn an exact decimal into a `double`.

### Idempotency

Temporal retries an activity whose attempt timed out, and Kafka delivers at least once, so every receiver makes its effect safe to repeat:

- **Natural key where the effect has one**: stock reservations (`(orderPublicId, offerId)`).
- **Per-service inbox where it doesn't**: account's `AccountInbox(consumer, messageId)`. `processOnce` inserts the row and runs the effect in the same transaction only if the row was new. A rejected charge rolls its row back, so a skipped duplicate is always a past success. A refund is applied only if the charge's inbox row exists. A refund that finds none inserts that row itself and answers `not_charged`: a charge attempt that timed out on the order side can still be running, and without the row it would be applied after the order was already compensated. The insert also serializes the two: whichever commits first wins, and the other sees the row. Inboxes are never shared between services.

### Calls between contexts

- **Ports, not brokers**: a context that needs an answer from another one depends on a `<Context>ClientInterface` in its own `client/` folder (`MediaClientInterface`, `SellerOfferClientInterface`, `AccountClientInterface`). The adapter calls the other context's published operation in-process today and becomes a gRPC client when that context moves out.
- **Contracts**: each call is an `…Rpc` namespace in `packages/messaging-contracts/src/<receiver>/rpc/` (`StockReserveRpc`, `AccountCustomerChargeRpc`, `MediaClaimRpc`, `SellerOfferPriceRpc`) with a `RequestInterface` and a `ResponseType`. The receiver's command handler returns that `ResponseType` itself, turning its rejection exceptions into `{ status: 'rejected', … }`, so callers never see the receiver's exceptions.
- **Idempotency key in the request**: requests carry their own key (`chargeId`, `orderPublicId`), so the receiver deduplicates without a transport envelope.
- **RabbitMQ as a transport**: `AccountClient.charge` goes over RabbitMQ, the example of swapping one adapter without touching the port or the activity. `RabbitMqRpcService.request({ exchange, method, source, id, data })` wraps the request in a CloudEvent and waits for the reply (5 s timeout, same message `expiration`, so an expired request is never charged later). Account answers in `AccountGateway` (`@RabbitRPC` on `account.commands` / `account.customer.charge`, quorum queue with DLX `account.dlx` → `account.customer.charge.dlq`): it nacks an invalid envelope to the DLQ, otherwise calls `AccountCustomerChargeCommandHandler.execute` and replies with `AccountMessage.toChargeReply`. A lost reply is safe: the activity retries with the same `chargeId` and the inbox skips it. Refund, stock and price calls stay in-process.

### Events (Kafka)

Synchronous questions go through ports (above). Kafka carries domain events, facts that already happened, kept in a log that any number of consumers can read and replay at their own pace.

| Topic | Producer | Events | Consumer groups |
|---|---|---|---|
| `identity.events` (3 partitions, kept forever) | identity | `identity.registered` after a registration commits | `user.profile` |
| `user.events` (3 partitions, kept forever) | user | `user.created` after the user row commits | `account.provisioning` |
| `order.events` (3 partitions, kept forever) | order | `order.created` (committed as `pending_payment`), `order.paid`, `order.failed` (`canceled` / `failed_payment` with a `reason`) | `order.notify` (broadcast) |

Registration provisions the rest of the person asynchronously:

```
POST /auth/register ─► Identity ─► identity.registered ─► user.profile ─► User ─► user.created ─► account.provisioning ─► Account(balance 0)
```

Each step is owned by its context: identity never writes users, user never writes accounts. An account belongs to the user (`Account.publicId` = the person's uuid, the one order charges), so account follows `user.created`, not `identity.registered`.

- **Same envelope**: a structured CloudEvent as the JSON value, headers `content-type: application/cloudevents+json` and `ce_type` (the event type, from the CloudEvents Kafka binding, so a consumer can skip types it doesn't handle without parsing the body). `id`, `subject` and `correlationid` are the aggregate's `publicId`, so `id` is stable for the fact and works as a consumer's dedup key.
- **Events carry the main data**, so a consumer never has to call back: `identity.registered` has `publicId`, `email`, `phoneNumber`, `role`, `createdAt`; `user.created` has `publicId`, `email`, `phoneNumber`, `firstName`, `lastName`, `language`, `createdAt`. Both `publicId`s are the person's uuid; no event carries an integer id. `data` is built by hand, never the entity. Older events in the topics still have `identityId`, `identityPublicId`, `userId` and `userPublicId`: every consumer reads `publicId ?? identityPublicId`, so a replay from the earliest offset gives the same result.
- **Key = `subject`**: all events about one identity land on the same partition and stay in order; different identities spread across partitions.
- **Topics**: `TopicEnum` lists every topic name regardless of broker. `RabbitMqModule` declares only the command exchanges, and `KafkaProducerService` (`src/generic/kafka/`) creates the topics it owns at startup with the admin API (an existing topic is left as it is; replication factor `-1` takes the broker default).
- **Producer**: `@confluentinc/kafka-javascript` (librdkafka) with idempotence on and `acks: all`, so a retried send never writes a duplicate and a send succeeds only once every in-sync replica has it.
- **Transactional outbox (identity and user)**: no producer calls Kafka directly. Register inserts an `IdentityOutbox` row in the same transaction as the `Identity`, and user inserts a `UserOutbox` row in the same transaction as the `User` (only when the user was actually inserted, so a redelivered `identity.registered` adds nothing). Each row has (`id` = the CloudEvent id, `broker`, `topic`, `aggregateType`, `aggregateId` = the Kafka key, `type`, `payload` = the event's `data`). `broker` (`kafka` or `rabbitmq`) says where the row goes: every relay hands each row to `MessagePublisherService` (`src/generic/messaging/`), which sends it to the Kafka topic keyed by `subject`, or to the RabbitMQ queue named by `topic` through the default exchange (media's variant jobs). So all outboxes keep one shape and one relay code, and a context that publishes to both brokers keeps one outbox and one order of its rows. If the transaction rolls back, there is no event; if it commits, the event is guaranteed to be sent, even if Kafka is down or the process dies right after. Each context has its own copy of the table, repository and relay (`IdentityOutboxRelay`, `UserOutboxRelay`), like separate services. A relay runs every second: in one transaction it claims up to 100 unpublished rows oldest first with `FOR UPDATE SKIP LOCKED`, builds the CloudEvent from each row (`source` from `SourceEnum`, `time` = `createdAt`), sends them in order, and sets `publishedAt` on the sent rows. The first failure increments `attempts`, stores `lastError` and ends the batch, so later rows never overtake it; the next run retries. A send gives up after 10 s (`message.timeout.ms`), so an unreachable Kafka shows up as `lastError = Local: Message timed out` instead of a transaction held open. Delivery is at-least-once: a row sent but not yet marked published (crash, or a timed-out send that still arrived) is sent again with the same `id`, which consumers already deduplicate. A daily job in the `maintenance` queue (see Redis below) deletes published rows older than 7 days; Kafka keeps the events.
- **Several app instances**: `SKIP LOCKED` lets every instance run the relay without sending a row twice, but two instances can send two events of the same identity out of order. With one event per identity (`identity.registered`) that can't happen; a second identity event type should come with a single active relay (a Postgres advisory lock taken per run).
- **One topic per aggregate, not per event type**: Kafka orders messages only within a partition of one topic, so `identity.registered`, a later `identity.email-changed` and `identity.deleted` for the same identity must share a topic to reach consumers in that order. A stream gets its own topic only when its volume or retention differs (e.g. a per-login event).
- **Replay instead of losing skipped events**: a consumer commits its offset past events it skips, so a handler added later never sees them in that group. Instead each use case is its own consumer group (`user.profile`, later `user.email-sync`): a new group starts from the earliest offset and replays the whole topic. An existing group can also be rewound (`kafka-consumer-groups.sh --group <group> --reset-offsets --to-earliest --execute --topic identity.events` while it is stopped) and relies on its idempotency for the events it already handled. Either works only while the events still exist, which is why `identity.events` has `retention.ms=-1`.
- **Topic config is set at creation only**: the client can't read or alter configs, so a change to an existing topic (as for `retention.ms` on a Kafka created before it was added) is a one-off `kafka-configs.sh --entity-type topics --entity-name <topic> --alter --add-config <name>=<value>`.
- **Consumers** (`KafkaConsumerService`, `src/generic/kafka/`): a context's consumer (`consumer/`) registers `{ groupId, topic, handle }` (`src/user/consumer/user-identity-events.consumer.ts`, `src/account/consumer/account-user-events.consumer.ts`), and all consumers start once the app has bootstrapped. The consumer skips types it doesn't handle and validates the rest with a zod schema of the fields it needs.
- **Commit after the effect**: the offset is committed only after `handle` resolves. A thrown error redelivers the same message, so a transient failure (database restarting) retries until it succeeds. User's follow-up event goes through `UserOutbox` in the same transaction as the user, so once the user is committed `user.created` will be sent, and a redelivery neither inserts a second user nor writes a second event.
- **Idempotent by natural key**: `User.publicId`, `Account.publicId` and `OrderBuyer.publicId` are unique; the inserts are `ON CONFLICT DO NOTHING`, so a redelivered or replayed event changes nothing.
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
- **Queue** (`redis-queue`, `@nestjs/bullmq`). One queue, `maintenance`: `MaintenanceJobRegistryService` holds the handlers contexts register, `MaintenanceQueueService` only touches the queue (`upsertJobScheduler` on bootstrap, `enqueue(name, jobId)`), and `MaintenanceProcessor extends WorkerHost` only runs jobs (`concurrency: 1`, started after every context registered, `@OnWorkerEvent('failed' | 'stalled')`). Jobs get `attempts: 3`, `backoff: { type: 'exponential', delay: 1000, jitter: 0.5 }`, and `removeOnComplete` as an age/count limit, never `true`, which would turn `jobId` dedup off. Each repeating task is its own class under the context's `cron/` folder that registers its cron pattern in `onModuleInit` (it never uses Nest's `@Cron`): the six outbox cleanups (`IdentityOutboxCleanupCron`, `UserOutboxCleanupCron`, `OrderOutboxCleanupCron`, `OrderWorkflowOutboxCleanupCron`, `ProductOutboxCleanupCron`, `MediaOutboxCleanupCron`, daily at 03:00) and media's `MediaOrphanCleanupCron` (hourly), `MediaUnattachedCleanupCron` (hourly) and `MediaClaimReleaseCron` (every 5 minutes). The outbox cleanups moved here from `@Cron`: `upsertJobScheduler` keeps one scheduler per name across restarts and pods, and each daily run is processed by one worker instead of every pod. A job with no handler fails at once with `UnrecoverableError`.

**If the stampede lock breaks.** If Redis loses the lock, the owner dies before releasing it or the 5 s wait runs out, several requests miss at once and each reads Postgres: N identical `SELECT`s instead of one, and the last `SET` wins with the same value. That costs a few database reads on one hot key for one moment; nothing is written, so nothing can end up inconsistent. That is why a lock is acceptable here: it protects a read that may be repeated, and every path where it fails degrades to the behaviour we had without it. The same `SET NX PX` guarding a write (one charge per order, one reservation per offer) would be wrong: a lock can expire under a slow owner, and two writers would both proceed. Those invariants are enforced in Postgres (`UPDATE … WHERE balance >= $n`, natural keys with `ON CONFLICT`), never with a Redis lock.

## Auth (identity)

| Endpoint | Auth | Body | Result |
|---|---|---|---|
| `POST /auth/register` | public | `{ email?, phone?, password }`, at least one of email or phone | `201` token pair, `409` if the email or phone is taken |
| `POST /auth/login` | public, 5 attempts per minute per ip+login | `{ login, password }`; a `login` starting with `+` is an E.164 phone, anything else an email | `200` token pair, `401`, `429` |
| `POST /auth/refresh` | public | `{ refreshToken }` | `200` new token pair, `401` |
| `POST /auth/logout` | public | `{ refreshToken }` | `204`, also for an unknown or already revoked token |
| `GET /auth/me` | token | — | `200 { identityPublicId, role, email, phoneNumber }`, `401` |
| `GET /auth/:provider` (`google`) | public | — | `302` to the provider, sets the `oidc_sign_in_state` cookie; `400` unknown provider, `503` if the provider or Redis is unavailable |
| `GET /auth/:provider/callback` | public, the provider redirects here | the provider's query (`code`, `state`, `iss`, …) | `200` token pair, `400` state not from this browser / expired / reused / another provider's, `401` the provider refused or the `id_token` failed a check, `409` the email already has an identity |
| `POST /auth/:provider/link` | token, 5 attempts per minute per ip+identity | `{ password }` | `200 { url }` to open in the browser, sets the cookie; `403` wrong password, `401` |
| `GET /.well-known/jwks.json` | public | — | `200 { keys }`, the public verification keys, `Cache-Control: public, max-age=60` |
| `POST /order` | token, `create Order` | order body (the buyer comes from the token) | `202`, `401`, `409` while the buyer is being provisioned |
| `GET /order/:id` | token, `read Order` + ownership | — | `200` own order (admin/owner: any), `403` someone else's, `401` |
| `POST /product` | token, `create Product` (seller, admin, owner) | `{ categoryId, brandId, translations: [{ language, title, description? }] }` | `201`, `403` for a buyer, `401`, `404` unknown category or brand |

A token pair is `{ accessToken, refreshToken, tokenType: "Bearer", expiresIn }`. In the homework's terms, orders are the "resource with an owner" and products the "resource only a privileged role writes".

### Variables

| Змінна | Джерело | Навіщо |
|---|---|---|
| `JWT_PRIVATE_KEY` | сховище (#11, Infisical) | ES256 private key, PEM or base64 of a PEM; signs access tokens, only identity reads it |
| `JWT_PUBLIC_KEY` | сховище (#11, Infisical) | ES256 public key(s), one or several PEM blocks or base64 of them; verifies access tokens by `kid` |
| `REFRESH_TOKEN_PEPPER` | сховище (#11, Infisical) | HMAC key of the stored refresh-token hashes |
| `DBPASSWORD` | сховище (#11, Infisical) | Postgres password |
| `DBUSER` | сховище (#11, Infisical) | Postgres user |
| `RABBITMQ_USER` | сховище (#11, Infisical) | RabbitMQ user |
| `RABBITMQ_PASSWORD` | сховище (#11, Infisical) | RabbitMQ password |
| `REDIS_CACHE_URL` | сховище (#11, Infisical) | cache Redis URL with its password |
| `REDIS_QUEUE_URL` | сховище (#11, Infisical) | queue Redis URL with its password (denylist, rate limit, BullMQ) |
| `GOOGLE_CLIENT_SECRET` | сховище (#11, Infisical) | OAuth client secret from Google Cloud Console; exchanges Google's codes as our app |
| `GOOGLE_CLIENT_ID`, `GOOGLE_ISSUER`, `OIDC_REDIRECT_BASE_URL` | оточення | the Google client id (public: it is in every authorize URL), Google's issuer for discovery, the base our callbacks `/auth/<provider>/callback` are built on |
| `DBHOST`, `DBPORT`, `DBNAME`, `KAFKA_BROKERS`, `TEMPORAL_ADDRESS`, `RABBITMQ_HOST` | compose / оточення | where the dev services are; not secrets |
| `ACCESS_DENYLIST_FAIL_OPEN` | compose / оточення | `true` (default) or `false`, outage policy of the denylist |
| `SKIP_VAULT` | оточення | `1` skips the vault and takes the secrets above from the environment |

`npm run start` is a bare start: it reads nothing from the vault on its own behalf, and with `SKIP_VAULT=1` and a secret missing it exits with `1` before touching the database, naming every missing variable (`Missing secrets: JWT_PRIVATE_KEY, …`). There are no defaults for secrets: a default key would be a key compiled into the code. `npm run start:vault` goes through `scripts/with-secrets.sh dev`, as `migrate` and `seed` do. A leaked `DATABASE_URL` gives access to the database from the network; a leaked signing key lets anyone mint a token for anyone without any access at all, which is why the keys and the pepper live in the vault and the app refuses to run without them.

Key fingerprints (the `kid`, RFC 7638 thumbprint of the public key; public data) prove the environments use different keys:

| Environment | `kid` |
|---|---|
| dev | `_VZEet1Vx932lxQckAZZJhRJiwIY1woEYhsR9Zl-N0s` |
| prod | `OVwlBCIW4WaBT_5ffXve5p0zxkP6XawsAIYdwOc7Fj4` |

### Tokens

- **Access token**: a 15-minute JWT signed with **ES256**. Claims: `sub` (the identity's `publicId`; the integer id never leaves identity), `role`, `email`, `phone_number`, `jti` (token id), `sid` (the session family), `iss: identity-service`, and a `kid` header. A JWT is signed, not encrypted: anyone holding it can read the claims, so nothing secret goes in.
- **Why ES256**: OWASP lists RS256 as not recommended (PKCS#1 v1.5 padding) and suggests ES256, PS256 or EdDSA; ES256 gives small keys and signatures and is supported everywhere. It is asymmetric: only identity holds the private key, every other context verifies with the public one and can't mint tokens. HS256 would make every verifier a signer.
- **Verification** (`AccessTokenVerifierService`) runs `jwtVerify` with an explicit `algorithms: ['ES256']` (RFC 8725 §3.1: this is what stops `alg: none` and RS/HS key confusion), the key chosen by `kid`, `iss`, `exp` with 5 s of tolerance and required `sub`, `exp`, `iat`, `jti`, `sid`; then the denylist. A token whose payload was edited (`role` → `admin`) keeps the old signature and fails with `401`: the token is verified, never just decoded.
- **Refresh token**: 32 random bytes, opaque (not a JWT), valid for 30 days. The database stores only `HMAC-SHA256(REFRESH_TOKEN_PEPPER, token)` in `IdentitySession` (created by migration), so a dump of the table is not a list of live sessions, and write access to the database alone can't plant a session: computing a valid hash needs the pepper from the vault. Changing the pepper invalidates every refresh session, so it is rotated only on compromise.
- **Rotation and reuse detection**: every refresh marks the token used (`UPDATE … WHERE "usedAt" IS NULL AND "revokedAt" IS NULL RETURNING`, so two parallel refreshes can't both win) and issues a new pair in the same family (`familyId`, one per login). A token that was already used coming back is a theft signal: the whole family is revoked in Postgres and on the denylist, and `refresh token reuse detected: revoking family=…` is logged; the honest client's newer token dies with it. A refresh and a revocation of the same family are serialized by an advisory lock on the `familyId`.
- **Logout is two actions**: `revokedAt` on the whole family in Postgres kills the refresh tokens, and `denied-family:<sid>` in Redis (TTL 15 min + 5 s, the longest an access token of the family can still live) kills the access tokens now instead of at `exp`. The denylist works by family rather than by `jti`, so it needs no index of issued tokens and also catches a token a racing refresh issued just before. The two writes go to two stores and are not atomic, the same dual write as in the outbox homework: Postgres is written first, Redis second. If Redis fails, the refresh token is already dead; with `ACCESS_DENYLIST_FAIL_OPEN=true` logout still answers `204` and the access tokens live until `exp` (at most 15 min), with `false` it answers `503` so the client retries (the Postgres part is idempotent).
- **Passwords**: argon2id, 8–128 characters. An unknown login, a wrong password and a deleted identity get the same `401 Invalid login or password`, and a dummy hash is checked for an unknown login, so timing doesn't reveal which accounts exist.
- **Key rotation without downtime and the role of `kid`**: every token names its signing key in the `kid` header. `JWT_PUBLIC_KEY` may hold several keys; the verifier picks the one the `kid` names (an unknown `kid` is a `401`). `TokenService` derives its `kid` from `JWT_PRIVATE_KEY`, and both sides re-read the vault every 60 s without a restart, logging once per change. That is what lets the keys overlap. To replace k1 with k2:
  1. Generate k2, set `JWT_PUBLIC_KEY` to k1 followed by k2. Keep `JWT_PRIVATE_KEY` = k1.
  2. Wait until every pod has logged `jwt verification keys: [<k1>, <k2>]` (at most a minute).
  3. Set `JWT_PRIVATE_KEY` = k2. New tokens carry k2's `kid`; k1 tokens still verify. A pod whose signing `kid` isn't among its verification keys logs a warning.
  4. Wait 15 min + 5 s after the last pod logged `jwt signing key: <k2>`, the longest a k1 token lives.
  5. Set `JWT_PUBLIC_KEY` = k2 only.

  If k1 leaked, skip the waiting: tokens forged with it would verify for as long as it stays in `JWT_PUBLIC_KEY`. Put k2 in both secrets at once; within a minute every k1 token is rejected, clients get a `401`, refresh (refresh tokens are in Postgres, not signed) and receive k2 tokens.

- **JWKS**: `GET /.well-known/jwks.json` publishes the public keys the verifier holds, `kid` included. Another service verifies our tokens with `createRemoteJWKSet` and that URL alone: no shared secret, no call to identity per request, and it learns a new `kid` from the endpoint during a rotation. `max-age=60` equals the 60 s refresh, so the rotation steps above cover outside verifiers as well. There is no `/.well-known/openid-configuration`: our `iss` is `identity-service`, not a URL.

### Authorization

- **Default deny**: `AccessTokenGuard` and `AbilityGuard` are global (`APP_GUARD`); every route needs a token unless it is marked `@Public()`. Both guards skip non-HTTP handlers.
- **401 vs 403**: no token, a broken, expired, revoked or forged one is `401` (`WWW-Authenticate: Bearer`, or `error="invalid_token"`): the client refreshes. A valid token without the right is `403` (`error="insufficient_scope"`), logged with who, what and which route: the client shows an error. Mixing them up makes a client loop on refresh or log the user out on every page it may not see.
- **Rules (CASL)**: `AbilityFactory` builds the abilities from the token's role in one place. Everyone can `create Order`; a buyer and a seller can `read Order` only where `buyerPublicId` is theirs, admin and owner any order; seller, admin and owner can `create Product`. `@CheckAbility(action, subject)` on a route checks the action at the type level in the guard (a buyer on `POST /product` gets `403` there).
- **Ownership is not checked in a guard**: a guard has the token, not the order. `OrderService.findReadableByPublicId` loads the order with its buyer (from the cache when it's there) and asks `ability.can('read', subject('Order', { buyerPublicId }))`; someone else's order is `403`. `POST /order` takes the buyer from the token: the token's `sub` finds the `OrderBuyer` (copied from `user.created`), the order stores its `buyerId`, and anything in the body that names a buyer is ignored.
- **The role in the token is a cache, not the source of truth**: an admin demoted in the database stays an admin for every request until his access token expires, up to 15 minutes, and can refresh into a new token only with the new role. To make a demotion instant, deny his session families (the same `denied-family` keys logout writes) or check the role in the database for critical actions.

### Sign in with Google

Authorization Code flow with PKCE (OIDC). Google only tells us who the person is; we then issue our own token pair, so refresh, logout, the denylist and the abilities work as for a password login. Google's own `access_token` is discarded.

1. `GET /auth/google` (any provider: `GET /auth/:provider`) creates `state`, `nonce` and `code_verifier`, stores them with the provider in redis-queue under `oidc-sign-in:<state>` for 10 minutes, sets `state` as an `HttpOnly; SameSite=Lax` cookie on `/auth` and redirects to Google's authorize URL with `state`, `nonce` and `code_challenge = BASE64URL(SHA256(code_verifier))`. Google's endpoints come from its discovery document, read once on first use; if Google is down only this flow answers `503`.
2. Google signs the person in and redirects the browser to `GET /auth/google/callback?code&state&iss`.
3. The callback checks, in order:
   - **the `state` equals the cookie**: an attacker who sends you his own callback link (login CSRF) would sign you into his account; his link carries his `state`, your browser your cookie;
   - **the `state` is in Redis**, read with `GETDEL`, and was started for this provider: an attempt works once, expires, and can't be finished at another provider;
   - **the code exchange** (`openid-client`): `code` + `code_verifier` + client secret go to Google's token endpoint. A code stolen from the redirect URL is useless without the verifier, which never left the server (`invalid_grant`);
   - **the `id_token`**: signature against Google's JWKS by `kid` (`enableNonRepudiationChecks`: `openid-client` skips it by default for a token received directly over TLS), `iss`, `aud` = our client id (a token Google issued to another app is refused), `exp`, and the `nonce` from Redis (a token from another sign-in is refused);
   - **`email_verified`**: accounts are unique by email, so an unverified address could claim someone else's.
4. In one transaction: the identity is found by `IdentityExternalAccount (google, sub)`. `sub` is Google's permanent id; an email can change or be reused, so it is never the key. A new person gets an `Identity` without a password, the external account and `identity.registered`, so user, account and order buyer are provisioned through Kafka exactly as after a password registration. An email that already has an identity is `409`, never linked silently: whoever controls that address at Google would otherwise take over the account.
5. Linking Google to a password account is `POST /auth/google/link` with the password again: a stolen 15-minute access token alone could otherwise attach the thief's Google and keep a permanent way in. It returns the authorize URL as JSON because a navigation can't carry the bearer token; the attempt remembers the identity, and the callback attaches Google to it (`409` if that Google account belongs to someone else or the identity already has one).

Errors: Google refused (`invalid_grant`, `access_denied`) or a check failed → `401 Sign-in with google failed` with the reason in the log; Google or Redis unavailable → `503`. The logs never carry the email or Google's tokens.

To use real Google: in Google Cloud Console create an OAuth client of type *Web application* with the redirect URI `http://localhost:3000/auth/google/callback`, add your account as a test user while the app is in *Testing*, put the client id in `.env` and the secret in the vault, then open `http://localhost:3000/auth/google`. The e2e tests run against `test/support/fake-oidc-provider.ts`, a minimal provider (discovery, JWKS, authorize, token with the PKCE check) that can also deny consent or sign a wrong `nonce`, `aud` or an unverified email.

**Adding another OpenID Connect provider** (Microsoft, GitLab, Auth0, Keycloak, …) is configuration: discovery, PKCE, `state`/`nonce`, the `id_token` checks, the routes and the tests are shared (`OidcClientService`, `OidcController`, one discovery per provider):

1. a value in `IdentityProviderEnum` and a migration `ALTER TYPE "public"."IdentityProviderEnum" ADD VALUE '<provider>'` (the column stays a Postgres enum, so the database refuses an unknown provider);
2. an entry in `OIDC_PROVIDERS` (`src/identity/constant/oidc-provider.constant.ts`): which variables hold its issuer and client id, which secret its client secret, and its scope;
3. `<PROVIDER>_ISSUER` and `<PROVIDER>_CLIENT_ID` in `environment.schema.ts` and `.env.example`, `<PROVIDER>_CLIENT_SECRET` in `SecretsInterface`, `SECRET_NAMES` and the vault;
4. at the provider, the redirect URI `<OIDC_REDIRECT_BASE_URL>/auth/<provider>/callback`.

Apple is not plain OIDC: its client secret is a JWT signed with your key and it posts the callback (`response_mode=form_post`), so it needs those two additions on top.

- **Seeded logins**: `seller1@example.com`, `buyer1@example.com`, … with the password `marketplace-dev`.
- **Not done yet**: refresh token in an `HttpOnly` cookie, an absolute session limit counted from login, a grace window for a client that refreshes twice in parallel, email/phone verification, unlinking Google and notifying the owner when it is linked, cleanup of expired sessions, and a token instead of `?buyerPublicId=` on the SSE stream.

## Files

Product photos and videos go from the client straight to object storage; our API decides who may upload what, under which key, and when the upload is real. Public files are served through a CDN layer in front of a bucket that is closed to everyone else.

```
client ─POST /media/upload {mimeType, sizeBytes}──────▶ API   guard, allowlist, server-made key, PENDING row, signature
client ─PUT bytes (presigned URL)─────────────────────▶ S3    the API is not on this path
client ─POST /media/:id/complete──────────────────────▶ API ─HeadObject / CompleteMultipartUpload─▶ S3   → READY
seller ─POST /product {mediaIds}──────────────────────▶ catalog ─claim─▶ media      ProductMedia + product.created
buyer  ─GET <MEDIA_PUBLIC_BASE_URL>/media/…───────────▶ edge (nginx cache) ─▶ shim ─SDK─▶ S3 (403 for anyone else)
owner  ─GET /media/:id────────────────────────────────▶ API   302 to a fresh 60 s presigned GET
```

### Variables

| Variable | Source | Used by | Notes |
|---|---|---|---|
| `STORAGE_ACCESS_KEY` | Infisical | API, `edge` | the `media-app` user, not the MinIO root |
| `STORAGE_SECRET_KEY` | Infisical (locally the same value as `secrets/storage_secret_key.txt`) | same | the right to read and write every file |
| `STORAGE_ENDPOINT` | `.env` | same | empty = AWS S3 |
| `STORAGE_REGION` | `.env` | same | |
| `STORAGE_BUCKET` | `.env` | same, `minio-init` | |
| `MEDIA_PUBLIC_BASE_URL` | `.env` | API (`ProductMedia` URLs) | |
| `EDGE_ORIGIN_PORT` | environment, default `8787` | `edge` | must match `proxy_pass` in `nginx/edge.conf` |
| `MINIO_ROOT_USER` | compose, default `root` | `minio`, `minio-init` | admin only, never used by the app |
| `minio_root_password` | `secrets/minio_root_password.txt` (docker secret) | `minio`, `minio-init` | |
| `storage_secret_key` | `secrets/storage_secret_key.txt` (docker secret) | `minio-init` creates `media-app` with it | |

`npm run edge` runs through `scripts/with-secrets.sh dev`, like `migrate` and `seed`. The storage key is worth more than a database URL: it reads and writes every file, and on AWS a CloudFront signing key would grant access to all private content of a distribution, so neither lives in an env file.

### Storage: one private bucket, one least-privilege user

`minio-init` (an `mc` container, idempotent) creates the bucket, sets anonymous access to `none`, creates `media-app` with a policy on this bucket only (`Get/Put/DeleteObject`, `AbortMultipartUpload`, `ListMultipartUploadParts` on `bucket/*`; `ListBucket`, `ListBucketMultipartUploads` on `bucket`) and sets `api stale_uploads_expiry=168h`. It then stays alive with a healthcheck on a marker file: `docker compose up --wait` treats an exited one-shot container as unhealthy and returns `1` even when it exited with `0`. The images are `pgsty/minio` / `pgsty/mc`, a community build of the same server, since MinIO no longer publishes images to Docker Hub or quay.io.

Keys are made by the server: `media/{ownerPublicId}/{uuid}.{ext}` (the owner is the person's uuid from the token), the extension from the content-type allowlist (`image/jpeg|png|webp` up to 20 MiB, `video/mp4|webm` up to 5 GiB). A client's file name never reaches the key; the validation pipe drops unknown fields, so `fileName: '../../etc/passwd'` doesn't even reach the handler. The list of a user's files is a query on `Media`, never a bucket listing.

### Presigned URLs: why these lifetimes

A presigned URL is a bearer token with no id and no registry, so it can't be revoked; a short lifetime is the only control, and it dies with the credentials that signed it anyway (an STS role session on AWS is an hour by default, whatever `expiresIn` says).

- **Upload PUT: 300 s.** S3 checks the expiry when a request starts, not when it ends, so the URL only has to cover the gap between `POST /media/upload` and the start of the PUT. In a form that is seconds; five minutes leaves room for a slow phone. The signature also covers `content-type`, `content-length` and `cache-control`: without `signableHeaders` the SDK signs only `host`, and a client could store `text/html` from our CDN domain or drop `Cache-Control`.
- **Multipart parts: 300 s, signed in batches.** `GET /media/:id/parts` lists what the server already has (`ListParts`) and signs at most 100 missing parts. When URLs expire the client asks again; a first upload is a resume with zero parts done.
- **Download: 60 s, behind `GET /media/:id`.** The stable address is ours: the guard and CASL run on every request, and the answer is a `302` (`Cache-Control: no-store`) to a fresh URL. The API stays on the authorization path and off the data path. Presigned URLs are never logged whole; logs carry the media id and the key.
- The SDK runs with `requestChecksumCalculation: 'WHEN_REQUIRED'`: by default it would sign `x-amz-checksum-crc32=AAAAAA==`, the CRC of an empty body, into every presigned PUT.

`complete` is what makes an upload real: `HeadObject` must find the object with the declared size, otherwise `409`. Without it a client could mark as ready a file it never sent.

### Multipart: threshold and part size

S3 allows at most 10 000 parts, and every part except the last must be at least 5 MiB. So:

- `partSize = max(5 MiB, ⌈size / 10 000⌉ rounded up to a whole MiB)`: 5 MiB up to ~48.8 GiB, then it grows (11 MiB for 100 GiB). A fixed 5 MiB would fail above 50 GB.
- threshold = `2 × 5 MiB = 10 MiB`: a smaller file has at most one full part, so resuming saves nothing and the extra round trips cost more than they save. Photos go as a single PUT, videos as multipart.

Until `CompleteMultipartUpload` the object doesn't exist (`HeadObject` → 404) even though the parts are stored. The client never collects ETags: `complete` takes them from `ListParts`. The resulting ETag is `md5(concat(md5 of each part))-N`, not the file's MD5, so comparing it with a local MD5 breaks silently on every multipart file.

Unfinished uploads are billed and invisible. `media-orphan-cleanup` (hourly, `maintenance` queue) aborts the multipart upload, deletes the object and the row of every `pending` media older than a day, storage first so a crash in between is retried. As a safety net, MinIO drops stale uploads after `stale_uploads_expiry` (168h); on AWS the same is a lifecycle rule. A rule like "delete objects older than 30 days" does not touch them; they are a different action:

```json
{ "Rules": [{ "ID": "abort-incomplete-multipart", "Status": "Enabled", "Filter": { "Prefix": "" },
              "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 } }] }
```

Finished uploads nobody uses are billed too. A claim that is never confirmed (the product transaction rolled back, so no `product.created` arrives) is released by `media-claim-release` after its ten-minute reservation, and the media is free again, not lost. Media that stays free for a day is deleted by `media-unattached-cleanup` (hourly): `ready`, `attachedToId IS NULL`, created more than 24 hours ago. A product create may claim the same row at that moment, so the cleanup deletes in three steps: a guarded `UPDATE … SET "deletedAt" = now() WHERE "attachedToId" IS NULL` (a claim requires `"deletedAt" IS NULL`, so whichever commits first wins and the other updates nothing), then the object, then the row. The cleanup also picks up rows that already have `deletedAt`, so a crash between the steps is retried on the next run.

### CDN: chosen form and the AWS variant

Locally (the graded form): `edge` is nginx with `proxy_cache` in compose; on a miss it asks the shim (`src/edge.ts`, ~60 lines of `node:http`, run with `npm run edge`), which fetches the object from the private bucket with the storage key and returns it with the object's `Cache-Control`. nginx has no `proxy_cache_valid`, so it caches exactly what the origin marks cacheable and adds `X-Cache: HIT|MISS`. That is the point of OAC: the cache layer reads the bucket, the public can't. The shim runs on the host because the credentials come from the vault through `with-secrets.sh`, which a container started by `docker compose up` doesn't have; nginx reaches it at `host.docker.internal` (`host-gateway`). It listens on `0.0.0.0:8787` so the bridge network can reach it; locally that exposes `media/` read-only to the LAN past the cache, which a production CloudFront doesn't have.

The shim serves only `media/`. It serves inline only the allowlisted types and sends anything else as `application/octet-stream` with `Content-Disposition: attachment` and `Content-Security-Policy: sandbox`; every response has `X-Content-Type-Options: nosniff`.

On AWS: Block Public Access on, CloudFront with Origin Access Control, and a bucket policy that lets only that distribution read. The `AWS:SourceArn` condition is required: without it any CloudFront distribution in any account could read the bucket.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOacRead",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::marketplace-media/media/*",
    "Condition": { "StringEquals": { "AWS:SourceArn": "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>" } }
  }]
}
```

Browsers PUT to the bucket's origin, so the bucket needs CORS for `PUT` from the shop's origin with `AllowedHeaders: content-type, cache-control`; `ExposeHeaders: ETag` is not needed because the server reads ETags itself. MinIO allows any origin by default. Private content later (seller documents) fits CloudFront signed URLs or signed cookies issued by our API; they are not part of this setup.

### Updates without invalidation

`Cache-Control: public, max-age=31536000, immutable` is set on the object at upload (signed into the presigned PUT, or set on `CreateMultipartUpload`), not on the edge: an object without it is fetched from the bucket on every request. A key never changes content: media keys carry a uuid. New content gets a new URL, the old cache entry harms nobody, and nothing is invalidated: CloudFront invalidations cost money past the free tier, propagate eventually, can't be undone and never reach browser or proxy caches. Only the entry point that names the hashed files (`index.html`, a manifest) is served with `no-cache`.

### Attaching media to a product

`POST /product { mediaIds }` asks media synchronously through a port (`MediaClientInterface`, the `MediaClaimRpc` contract; an in-process `MediaClient` now, gRPC once media is a service). One guarded `UPDATE` claims all ids or none: owned by the caller, `ready`, and free or already attached to this product, with `claimExpiresAt = now() + 10 min`. Catalog then commits `Product`, `ProductMedia` (position plus a copy of key, type and size, so a product page never calls media) and a `product.created` outbox row in one transaction. Media's consumer (`media.attachment`) clears `claimExpiresAt`; `media-claim-release` detaches claims that were never confirmed, for example when the product insert failed. Responses carry `url = MEDIA_PUBLIC_BASE_URL + '/' + storageKey`; storing the key rather than the URL makes a CDN change a config change.

### Variants: webp, webm and a ThumbHash

A product page should not download a 6 MB phone photo for a 320 px card, and not every browser plays an iPhone's HEVC mp4. Media therefore makes variants of every original it has to show:

| Kind | Variants | How |
|---|---|---|
| image (jpeg, png, webp) | `w320`, `w800`, `w1600` webp, quality 80, only the widths the original fills (a smaller image gets one `w320` at its own size); EXIF rotation applied | sharp (libvips) |
| video (mp4, webm) | `video-720` (VP9 + Opus webm, at most 720 p high, never enlarged) and `poster` (webp of the frame at 1 s) | ffmpeg / ffprobe |
| both | `thumbHash`: a ≤25-byte blurred placeholder with the aspect ratio, from the image or the poster | `thumbhash`, on the main thread (about 0.5 ms once warm; a worker thread cost more than it saved) |

Variants sit next to the original under the same immutable `Cache-Control`: `media/{owner}/{uuid}.png` → `media/{owner}/{uuid}/w320.webp`, `…/video-720.webm`, `…/poster.webp`.

**When.** Only for media a product has confirmed, not for every upload: unattached media is deleted after a day, and a VP9 encode costs about the length of the video in CPU time. The confirm (`product.created` consumed by media) writes a `media.variants.generate` row to `MediaOutbox` in the same transaction, only for the media its guarded `UPDATE` actually confirmed and with the media id as the row id, so a redelivered `product.created` adds no second job. A product can be live a moment before its variants exist; clients show the original or the ThumbHash meanwhile.

**Where the work runs.** The job is work nobody awaits, so it goes to a RabbitMQ work queue, not to Kafka: a Kafka consumer handles a partition in order, and a five-minute encode would hold back every later event on it. `MediaOutbox` rows name their `broker`: the job row is `rabbitmq` and goes through the default exchange to the queue `media.variants` (quorum, `x-delivery-limit: 5`, dead-lettered through `media.dlx` to `media.variants.dlq`), declared by `MediaTopologyService`. `MediaVariantsJob` consumes it on the generic `work` channel with prefetch 1, so an instance holds one job at a time and the rest wait in the broker, not in memory; more throughput means more consumers.

**The job** (`MediaVariantsGenerateCommandHandler`) skips media that is gone, not ready, or already has variants (a redelivery after a crash does nothing), downloads the original to a temp dir, picks the encoder by kind (`MediaVariantEncoderResolverService`: `MediaImageVariantService` or `MediaVideoVariantService`, both `MediaVariantEncoderInterface`), uploads the files, and in one transaction inserts the `MediaVariant` rows, sets `Media.thumbHash` and writes a `media.variants.generated` event row (`broker: kafka`, topic `media.events`) only when the rows were actually inserted. Then it acks.

**Failures.** A malformed message or a file that cannot be decoded is nacked without requeue and lands in the DLQ at once: a retry cannot fix it. Any other error (storage down) is requeued, at most 5 deliveries. Uploads are user input, so decoding is restricted:

- images: only jpeg, png and webp are decoded, read from the bytes (sharp would also open SVG, GIF, TIFF…), at most 50 Mpx, checked from the header before decoding;
- video: the container comes from the magic bytes (`ftyp` → `mov` demuxer, `1A 45 DF A3` → `matroska`), never from ffmpeg's guess, and every ffmpeg/ffprobe call gets `-f <demuxer> -protocol_whitelist file`. Without that, an "mp4" that is really an HLS playlist or a concat list makes ffmpeg fetch URLs (SSRF) or read local files such as `/proc/self/environ` into the output;
- video limits: at most 3840×2160 and 600 s (also `-t 600` for files without a duration), ffmpeg killed after 15 min (below RabbitMQ's default `consumer_timeout` of 30 min), and a kill counts as unprocessable, so it is not retried five times.

Running the job in its own container without network access would be the next layer; today it runs in every app instance.

**Reading them.** Product never reads media's tables. `ProductMediaEventsConsumer` (group `product.media-variants`) copies `media.variants.generated` into `ProductMediaVariant` rows and `ProductMedia.thumbHash` (idempotent by `(productMediaId, name)`). `GET /product/:publicId` (public) answers each media with `thumbHash` and `variants: [{ name, mimeType, url, width, height }]`, URLs on `MEDIA_PUBLIC_BASE_URL` like the original; a client builds `srcset` from the widths and shows the ThumbHash until the first variant arrives. `POST /product` answers `thumbHash: null, variants: []`, since generation starts after its commit.

## Realtime order status (SSE)

`GET /orders/:id/events?buyerPublicId=<uuid>` (`:id` is the order's uuid) streams the order's status as SSE `order.status` events: `pending_payment`, then `paid`, or `canceled` / `failed_payment`. The buyer id is an ownership hint, not authentication.

The stream is fed from Kafka, not from the code that changes the status. Order writes `order.created`, `order.paid` and `order.failed` through `OrderOutbox` in the same transaction as each status change; `OrderNotifyEventsConsumer` consumes `order.events` as a broadcast consumer on every instance and records each event in `OrderNotifyService`, which pushes it to that order's SSE listeners and keeps the last 100 per order. The SSE `id` is the Kafka offset + 1: all events of one order are on one partition (key = `publicId`), so ids only grow per order and are the same on every instance, and a reconnect with `Last-Event-ID` resumes correctly on any instance. Offset + 1 because the first message of a partition has offset 0, which `Last-Event-ID` would treat as "nothing seen yet". The history is in memory: it is rebuilt from new events after a restart, not from the past. A status reaches the stream about a second after the change (the outbox relay's poll interval). SSE fits one-way notifications: the browser's `EventSource` reconnects by itself and sends `Last-Event-ID`.

## Container image

`npm run image:build` builds `docker/Dockerfile` with BuildKit into `marketplace-api:hw28`:

- `manifests` copies `package.json`, the lock file, `.npmrc` and the workspace manifests and drops their `scripts` (`npm pkg delete scripts`); `deps` and `prod-deps` copy that result and run `npm ci` on `node:24-trixie-slim` (Debian 13, glibc 2.41 and Node 24.22.2, the same as the runtime, so the prebuilt native modules of `sharp`, `argon2`, `@confluentinc/kafka-javascript` and `@temporalio/core-bridge` load as they are); `build` compiles; `ffmpeg` provides the static `ffmpeg`/`ffprobe` that media variants call; `runtime` is `gcr.io/distroless/nodejs24-debian13:nonroot`: no shell, no package manager, uid `65532`.
- Layer reuse, measured: a change in `src/` rebuilds only `build` and the `dist` layer (3.9 s); a change of `scripts` alone rebuilds only `manifests` and `build` and reuses both `npm ci` and the 619 MB `node_modules` layer (5.0 s, it was 32.3 s before `manifests`: the cache key of `COPY package*.json` is the whole file, so any new npm script reinstalled everything twice). BuildKit compares the output of `COPY --from=manifests` by content, so stripped manifests that didn't change keep the cache. `npm ci` doesn't read `scripts`, `build` still gets the real `package.json` through `COPY . .`, and the runtime gets the stripped one (`type`, `exports` and `workspaces` are all Node needs). `/root/.npm` is a cache mount, so even a real reinstall takes tarballs from the cache, not the network.
- The registry token reaches `npm ci` only as a BuildKit secret (`--secret id=npm_token,src=.npm_token`, mounted as `NPM_TOKEN` for that one `RUN`); `.npmrc` holds `${NPM_TOKEN}`, not the value. `ARG` would keep the value in the image history and `COPY` + `rm` in the bytes of an earlier layer. There is no private registry yet, so `.npm_token` is a decoy for the scope `@marketplace-private` on `npm.invalid`, which no dependency uses.
- `.dockerignore` is an allowlist: only the manifests, the compiler configs, `src` and the workspace packages reach the build context, so a new file in the repository (state, keys, env files) never does by accident.
- `packages/*/src` stays in the image next to `dist`: the Temporal worker bundles the workflows with webpack at startup in `development` mode, which picks the `development` export condition (`./src/index.ts`) of `@marketplace/contracts-core`. Without it the worker fails with `no valid target file was found`.
- No `HEALTHCHECK`: distroless has no tool to run one, and Kubernetes uses its own probes.

### Image scan

`npm run scan` runs trivy on `marketplace-api:hw28` (`SCAN_IMAGE`), counts the findings of the report and compares them with `SCAN_MAX`: `found <= max-allowed` prints `gate=pass` and exits `0`, otherwise `gate=fail` and `1`. A missing report (the scanner failed, the image doesn't exist) or a non-numeric `SCAN_MAX` exits `2`, never `pass`. It prints `image=`, `severity=`, `ignore-unfixed=`, `found=`, `max-allowed=`, `gate=` and, after `#`, the split by severity and by target.

- Counted: `CRITICAL,HIGH` (`SCAN_SEVERITY`) with `--ignore-unfixed` (`SCAN_IGNORE_UNFIXED=false` counts everything): only what an update can fix, so the number is something we can act on.
- Working threshold `2` (the default in the `scan` npm script, used by CI): the count on 2026-11-08, so a new finding fails the gate and the threshold is lowered as findings are fixed. Both are HIGH in `zlib1g` of the distroless base, fixed in Debian (`+deb13u1`) and waiting for a rebuilt image. The first scan found 15 and the rest were closed the same day: `@temporalio/*` 1.24 → 1.25 brought the Rust crate `zip` 8.5.1 → 9.0.5 inside `core-bridge` (1 CRITICAL, 3 HIGH); `npm update` brought `fast-uri` 3.1.9 and `source-map-js` 1.2.2; `overrides.multer: 2.5.0` replaces the `2.4.0` that `@nestjs/platform-express` 12.2 pins exactly (drop the override once Nest is ≥ 12.3, which pins `2.5.0` itself); moving from `nodejs24-debian12` to `nodejs24-debian13` (and the build stages from bookworm to trixie, so the native modules are built against the runtime's glibc) removed the 7 in `libssl3` (1 CRITICAL, 6 HIGH). The trivy database changes daily, so the same image can fail tomorrow without a code change; that is the point of the gate, not a flake.
- trivy `0.76.1` is a binary on `PATH` when there is one, otherwise `docker run aquasec/trivy:0.76.1` with the Docker socket and a `trivy-cache` volume; both gave the same `found`.
- CI (`.github/workflows/scan.yml`, on pull requests and pushes to `main`) builds the image with a random decoy token, downloads trivy by version and checks its sha256 before running it, then calls `npm run scan`. Actions are pinned by commit (`actions/checkout` `3d3c42e5…` = v7.0.1, `actions/cache` `55cc8345…` = v6.1.0), not by tag: a scanner runs with the job's credentials, and trivy's own release and action tags were replaced with credential-stealing builds in 2026, so a moved tag must not change what runs.

### Demo: image

<!-- TODO(hw-28): remove after homework -->

`npm run demo:image` reads the built image, not the Dockerfile text, except for `stages` (the `FROM` lines of `docker/Dockerfile`): `shell-inside` tries `sh`, `/bin/sh`, `/bin/bash` and `/busybox/sh` as the entrypoint; `runtime-uid` is `Config.User`, resolved through the image's own `/etc/passwd` when it is a name and `0` when it is empty; the token from `.npm_token` is searched in `docker history --no-trunc`, in `docker image inspect` and in every layer listed by the `manifest.json` of `docker save` (decompressed, the config blob left out). It exits `1` when an invariant breaks. `npm run demo:image:leaky` builds two broken variants from `demo/leaky/` in a throwaway context and runs the same script on them. Three runs each, identical:

| Key | `demo:image` | `ARG` in the final stage | `COPY` + `rm` in the next layer |
|---|---|---|---|
| `stages` | 6 | 2 | 2 |
| `shell-inside` | 0 | 1 | 1 |
| `runtime-uid` | 65532 | 0 | 0 |
| `token-in-history` | 0 | 2 (`ARG NPM_TOKEN=…`, `RUN \|1 NPM_TOKEN=…`) | 0 |
| `token-in-config` | 0 | 0 | 0 |
| `token-in-layers` | 0 | 0 | 1 |
| exit | 0 | 1 | 1 |

No single channel sees both leaks: `ARG` lives only in the history, `rm` leaves only a whiteout on top of the layer that still holds the bytes. An `ARG` used only in a builder stage does not show in the final image's history at all (measured: all three counters `0`), so the leaky variant uses it in the stage that becomes the image.

## Health and graceful shutdown

- `GET /healthz` (liveness) checks nothing but the process: it answers while the event loop runs. A dependency that is down must not get a pod restarted.
- `GET /readyz` (readiness) answers `200` only when Postgres answers a ping within 500 ms and the instance is not draining, otherwise `503` with the failed check (`database` or `shutdown`). Kafka, RabbitMQ and Redis are left out on purpose: an outage of one of them would take every pod out of the load balancer at once, and the Redis paths already degrade by policy.
- `SIGTERM` (`enableShutdownHooks()`, the Nest default): `HealthShutdownService.onModuleDestroy()` turns readiness red at once and waits `DRAIN_MS` while the instance keeps serving; only then do the other modules close their clients and `app.close()` closes the socket. Closing first would refuse new connections while the load balancer still sends traffic.
- Why `onModuleDestroy` of the health module: Nest runs shutdown hooks module by module, awaited one at a time, in the reverse order of initialisation, so modules near the root go first and deeply imported or global ones last. `HealthModule` is imported by `AppModule`; `TemporalModule`, `KafkaModule`, `StorageModule` and `RedisModule` sit deeper and close after the drain. Only `OrderPlaceWorker` (same depth) stops before it, which doesn't touch HTTP. The e2e test logs in during the drain, so a change of that order fails it: with the drain moved to `beforeApplicationShutdown` the login gets `500 Connection is closed.` (Redis). `@nestjs/terminus`' `gracefulShutdownTimeoutMs` waits in `beforeApplicationShutdown` as well, so it is not used.
- `useProcessExit: true`: by default Nest re-raises the signal to itself after the hooks (`process.kill(process.pid, signal)`), and a container's PID 1 ignores a signal it has no handler for, so the pod would hang until `terminationGracePeriodSeconds` and get `SIGKILL` (`137`). Measured on `node:24-alpine` with that pattern: still `running` 3 s after `SIGTERM`. With the option Nest calls `process.exit(0)`. Distroless has no `tini`/`dumb-init` to reap signals instead.
- The drain runs on every close, `SIGINT` and `app.close()` in tests included; set `DRAIN_MS=0` locally to skip it.
- There is no artificial warm-up before `listen()`: connecting TypeORM, the Kafka producer, RabbitMQ, Temporal and both Redis instances takes about 2.65 s from process start to the first answer (three runs: 2.65, 2.66, 2.65 s), so a pod without a readiness probe gets traffic it cannot answer yet.

## Kubernetes

### Cluster

kind `v0.33.0`, one node `kindest/node:v1.36.4` (pinned by digest in `k8s/kind-config.yaml`; v1.36 because the local `kubectl` is v1.35 and a client supports one minor version of skew), on Docker with 31 GiB of memory. Measured on this machine: `kind create … --wait 120s` until the node is `Ready` 27.7 / 29.2 / 30.6 s, joining the compose network and `kind load docker-image` 12.9–15.6 s, the idle node 640 MiB.

- `npm run cluster:up` (`scripts/cluster-up.sh`) creates the cluster unless it exists, connects the node to the compose network `marketplace-api-v2_default` and loads `marketplace-api:hw28` into it. Run it again after every `image:build`: an image built on the host does not exist in the cluster, and the pod would hang in `ErrImagePull` whatever its `imagePullPolicy`. kind reloads the image every time (about 8 s) because Docker's containerd image store reports the manifest-list digest as the image id and the node the config digest, so they never match.
- `npm run cluster:down` deletes it.
- Only the API runs in the cluster. Postgres (through pgbouncer), Kafka, RabbitMQ, Temporal, both Redis instances and MinIO stay in compose, as managed services would stay outside a production cluster. With the node on the compose network, pods resolve the compose service names through CoreDNS and Docker's DNS (checked from a pod: `db-bouncer:5432`, `kafka:29092`, `rabbitmq:5672`, `temporal:7233`, `redis-cache:6379`, `redis-queue:6379`, `minio:9000` all open), so Kafka's internal listener, which already advertises `kafka:29092`, works without another listener.
- The scripts use `$KUBECONFIG` when it is set; locally the cluster lives in `~/.kube/kind-marketplace`, so creating it doesn't switch the default context of another kubeconfig.

## Secrets

Secrets live in Infisical, not in env files. `scripts/with-secrets.sh <env> <command>` loads `.env` (non-secret settings) and runs the command under `infisical run`, which injects `DBPASSWORD`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `REDIS_CACHE_URL`, `REDIS_QUEUE_URL`, `REFRESH_TOKEN_PEPPER`, `GOOGLE_CLIENT_SECRET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY` (see `SecretsInterface`). The Redis URLs carry the password (`redis://default:<password>@host:port`), so they are secrets rather than settings; `npm run bootstrap:secrets` writes that password to `secrets/redis_password.txt` for compose, taking it from the URLs so it lives in one place. Every npm script that needs the database goes through it. With `SKIP_VAULT=1` the wrapper runs the command directly and expects the values in the environment.

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
npm run test:all          # all three at once, output prefixed per suite, fails if any suite fails
```

Integration and e2e tests start their containers once per run (Postgres, RabbitMQ, Kafka, Temporal, MinIO and two Redis instances with the same eviction settings as compose, so nothing depends on a running dev stack) and reset state after every test (`test/support/isolation.ts`: `DELETE` from every table with foreign-key checks off for that one transaction (`SET LOCAL session_replication_role = replica`), about 7 ms where a `TRUNCATE` per table took about 175 ms; then `FLUSHALL` both Redis instances). Sequences are not restarted: a Kafka consumer can commit a row just after the cleanup with an id it drew before it, and a restarted sequence would hand the next test the same id, because the app's own `@Transactional()` opens real transactions that a wrapping test transaction would interfere with. The tests poll the outboxes every 100 ms (`OUTBOX_RELAY_INTERVAL_MS`) instead of every second.

`test:all` runs the suites side by side because integration and e2e start their own containers. Inside a suite the files run in `TEST_WORKERS` workers (default `4`; `TEST_WORKERS=1` runs them one by one on a machine with little memory). Every e2e file boots the whole app, and every test wipes the database and Redis, so workers can't share infrastructure: the global setup starts one container set per worker in parallel (e2e: Postgres, RabbitMQ, Kafka, Temporal, MinIO, two Redis; integration: Postgres and two Redis) and each worker connects to its own set by `VITEST_POOL_ID`. Four e2e sets take about 4 GB of memory.

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
| `OUTBOX_RELAY_INTERVAL_MS` | no | `1000` | how often each outbox relay (identity, user, order events, order workflow starts, product, media) polls for unpublished rows; the tests use `100` |
| `TEMPORAL_ADDRESS` | no | `temporal:7233` | Temporal frontend (`localhost:7233` when the app runs outside Docker) |
| `TEMPORAL_NAMESPACE` | no | `default` | Temporal namespace of the order workflows |
| `GOOGLE_CLIENT_ID` | yes | — | Google OAuth client id |
| `GOOGLE_ISSUER` | no | `https://accounts.google.com` | OpenID provider for Sign in with Google (its discovery document is `<issuer>/.well-known/openid-configuration`) |
| `OIDC_REDIRECT_BASE_URL` | no | `http://localhost:3000` | base of the callbacks: `<base>/auth/<provider>/callback` must match the redirect URI registered at the provider exactly |
| `STORAGE_ENDPOINT` | no | empty | S3-compatible endpoint (`http://localhost:9010` for MinIO); empty means AWS S3 and virtual-hosted URLs |
| `STORAGE_REGION` | no | `us-east-1` | bucket region, part of every signature |
| `STORAGE_BUCKET` | no | `marketplace-media` | the one private bucket (`media/`) |
| `MEDIA_PUBLIC_BASE_URL` | no | `http://localhost:8088` | CDN base that public media URLs are built on (the nginx edge locally, a CloudFront domain in production) |
| `DRAIN_MS` | no | `5000` | after `SIGTERM`, how long the instance stays up with readiness red before it closes; must be below `terminationGracePeriodSeconds` |
| `INFISICAL_SITE_URL`, `INFISICAL_CLIENT_ID`, `INFISICAL_PROJECT_ID`, `INFISICAL_ENVIRONMENT` | yes | — | secret store access |

Secret values (`DBPASSWORD`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `REDIS_CACHE_URL`, `REDIS_QUEUE_URL`, `REFRESH_TOKEN_PEPPER`, `GOOGLE_CLIENT_SECRET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`) come from Infisical, or from the environment with `SKIP_VAULT=1`.
