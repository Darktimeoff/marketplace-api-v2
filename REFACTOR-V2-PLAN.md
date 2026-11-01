# Plan: refactor-v2, a single identifier model

## Target rules

| Kind of table | Key | `publicId` |
|---|---|---|
| Aggregate / entity | `id` int identity | generated, if referenced from outside |
| Projection of another context's entity | `id` int identity | **copied** from the source, no `DEFAULT` |
| Child reachable only through its parent | `id` int identity | none |
| Association (m2m with payload) | composite of the pair it links | none |
| Infrastructure (outbox, inbox) | the message id | none |

| Reference | Form |
|---|---|
| inside a context | `<entity>Id int` + an FK |
| to another context | `<entity>PublicId uuid`, no FK |
| a person | one uuid everywhere = `Identity.publicId` = JWT `sub` |

The integer `id` never leaves its context: not in HTTP, not in events, not in RabbitMQ.

---

## Pass 1. A person: one uuid

### 1.1 identity + user

- [x] **Migration `UnifyUserIdentity`:** `UPDATE "User" SET "publicId" = "identityPublicId"`; drop `identityId`, `identityPublicId`, `User_identityId_key`, `User_identityPublicId_key`; `publicId` loses its `DEFAULT`. Rewrite `UserOutbox.id` / `aggregateId` from the old user uuids.
- [x] **Contracts:** `IdentityRegisteredEvent.DataInterface` = `{ publicId, email, phoneNumber }`, without `identityId`. `UserCreatedEvent` = `{ publicId, userId, email, phoneNumber, firstName, lastName, language, createdAt }`, without `identityId`, `userPublicId`, `identityPublicId`. **Expand → contract:** `userId` stays until 1.3, because account (until 1.2) and order buyer (until 1.3) still key on it.
- [x] **Code:** `identity-message.service`, `user-identity-events.gateway` + `schema/identity-registered-event.schema.ts`, `user-create.command-handler` (create by `publicId`, `ON CONFLICT ("publicId")`), `user.repository` (`findByPublicIdOrFail`), `user-message.service`, `seed.ts`.
- [x] **Tolerant reader** in the consumers of `identity.registered` / `user.created`: `publicId ?? identityPublicId`, so a replay of old events from Kafka gives the same result.
- [x] **Tests:** `identity-message.service.spec`, `user-message.service.spec`, `registration-provisioning.e2e`, `identity-events.e2e`, `auth.e2e`, `test/support/builders.ts`, `buyer.ts`. A new test: an old-format event is processed exactly like a new one.

### 1.2 account

- [x] **Migration `AccountIdentifiers`:**
  - `Account`: add `id` identity, add `publicId uuid` and backfill `"publicId" = User."publicId"` by `customerId = User.id` (a one-off cross-context read, which only migrations may do). The PK moves to `id`; add unique `Account_publicId_key`.
  - `Transaction`: add `accountId` and backfill from `Account.id` by `customerId`; drop `Transaction_customerId_fkey`, the index and `customerId`; add `Transaction_accountId_fkey` (`RESTRICT`) and `Transaction_accountId_idx`.
- [x] **Consumer:** `account-user-events.gateway` switches from `userId` to `publicId` (tolerant reader, as in 1.1).
- [x] **Contracts:** `AccountCustomerChargeRequest` / `AccountCustomerRefundRequest`: `customerId: number` → `customerPublicId: string`.
- [x] **Code:** the entities, `account.repository` (`debit` / `credit` / `findBalance` / `createIfAbsent` by `publicId`, `ON CONFLICT ("publicId")`), the charge / refund / create command handlers, `account.gateway` (uuid validation instead of `isSafeInteger`), `account-user-events.gateway` + schema (tolerant reader), `seed.ts`.
- [x] **Tests:** `account-refund.e2e`, `order-create.e2e`, `order.e2e`, `order-realtime.e2e`, `registration-provisioning.e2e`. A new integration test of `debit` by `publicId` that keeps the balance guard.
- [x] **Order sender:** until 1.3 the workflow input still carries `userId`; the charge / refund activities map it to the person uuid through order's own `OrderBuyer`, so in-flight workflows are untouched.

### 1.3 order buyer + order

- [x] **Migration `OrderBuyerIdentifiers`:**
  - `OrderBuyer`: add `id` identity, `publicId` = the current `identityPublicId`; the PK moves to `id`; drop `userId` and `OrderBuyer_userId_key`.
  - `Order`: add `buyerId` and backfill it through `OrderBuyer` by `ownerIdentityPublicId`; old orders without it get backfilled through `userId`. Then make `buyerId` `NOT NULL` with the FK `Order_buyerId_fkey`.
  - Drop `Order.userId`, `ownerIdentityPublicId`, its index, and `Order_userId_idempotencyKey_key`; add `Order_buyerId_idempotencyKey_key` instead.
- [x] **Code:**
  - `order-buyer.repository`, `order-user-events.gateway` + schema (tolerant reader);
  - `order-place.command-handler`, `order.repository` (idempotency lock by `buyerId`), `order-access.service` / `guard`;
  - `ability.factory` + `app-ability.type`: the `Order` subject gets a `buyerPublicId` condition;
  - `order.service`, `order-place-message.service` (charge / refund with `customerPublicId = buyer.publicId`);
  - `order-place.activity`, `order-place-workflow.interface`.
- [x] **Contract (contract step):** drop `userId` from `user.created`; nothing reads it any more.
- [x] **Temporal:** the workflow input changes from `userId` to `buyerPublicId`, so a workflow started with the old input breaks on replay. On dev, before applying: wait for running workflows to finish or terminate them (`temporal workflow list`). Add a line about it to the README.
- [x] **Tests:** `order.repository.integration`, `order-create.e2e`, `order.e2e`, `order-realtime.e2e`, `order-place-message.service.spec`, `ability.factory.spec`, `test/support/buyer.ts`.
- [x] **Found while applying:** 5 dev orders pointed at users that no longer exist and had no owner. The migration gives each such `userId` an "unknown" `OrderBuyer` with a fresh uuid, so the orders keep their history and only admins can read them; `down` cannot restore those junk `userId`s and writes `0`.
- [x] **Moved here from pass 3:** `order.created / paid / failed` carry `buyerPublicId` instead of `userId` (the only consumer reads `orderId` / `status`); the SSE guard takes `?buyerPublicId=` instead of `?userId=`; the order cache key is now `order:v2:<id>` so cached orders of the old shape are not served.

### 1.4 seller owner and media owner

- [x] **Migration `PersonOwners`:** `Seller.userId` → `ownerPublicId uuid` (backfill from `User.publicId`, which is already the person's uuid after 1.1); `Media.ownerIdentityPublicId` → `ownerPublicId` (a rename).
- [x] **Code:**
  - `seller.entity`, `seed.ts`;
  - media: the entity, repository, the four command handlers, `media.service`;
  - `MediaClaimRpc.RequestInterface.ownerIdentityPublicId` → `ownerPublicId`;
  - `product-create.command-handler`.
- [x] **Tests:** `media.repository.integration`, `media-message.service.spec`, `media.e2e`, `product-media.e2e`.

---

## Pass 2. Catalog → seller → order: references by uuid

### 2.1 offer → variant

- [x] **Migration:** `SellerOffer.variantId` → `variantPublicId uuid` (backfill from `ProductVariant.publicId`).
- [x] **Code:** `seller-offer.entity`, `seed.ts`, `test/support/builders.ts`.

### 2.2 order line → offer, stock

- [x] **Migration:** `OrderLine`: PK `(orderId, offerId)` → `(orderId, offerPublicId)` (backfill from `SellerOffer.publicId`). `StockReservation` stays as is (`offerId` is an FK inside seller).
- [x] **Contracts:** `StockReserveRequest` / `StockReleaseRequest`: `offerId` → `offerPublicId`. `OrderCreateRequest.items[].offerId` → `offerPublicId`.
- [x] **Code:**
  - the seller-offer gateway and reserve / release handlers resolve `offerPublicId → SellerOffer.id` inside seller;
  - `order-create.input`, `order-place.command-handler` (price read through the seller-offer service, by `publicId`);
  - `order-place-message.service`, the workflow interface, the `order-line` entity.
- [x] **Temporal:** the same as in 1.3; the workflow input changes.
- [x] **Tests:** `order-create.e2e`, `order.e2e`, the stock e2e, `order-place-message.service.spec`.
- [x] **Moved here from pass 3:** `order.paid.lines[].offerId` → `offerPublicId`, since `OrderLine` no longer has the int.

### 2.3 product → category / brand over HTTP

- [x] **Contracts:** `ProductCreateRequest` / `ProductResponse`: `categoryId` / `brandId` → `categoryPublicId` / `brandPublicId`.
- [x] **Code:** `product-create.input`, the handler (resolve the uuid → the catalog's int FK), `product-response.service`, `product.dto`. The int FKs inside catalog stay.
- [x] **Tests:** `product.e2e`, `product-media.e2e`, `product-response.service.spec`.
- [x] **Behavior change:** category and brand are resolved before the media claim, so a 404 no longer reserves media. The release test now claims directly through `MediaClaimCommandHandler`.
- [x] **Found while testing:** test cleanup reset every sequence to 1, and a Kafka consumer committing a row after cleanup collided with the next test's ids (`OrderBuyer_pkey`). Cleanup no longer resets sequences (separate commit).

---

## Pass 3. The order API and order events

- [ ] **HTTP:** `GET /order/:id` and SSE `/orders/:id/…` switch to `ParseUUIDPipe` and look up by `publicId`; `OrderResponseInterface.id` = the uuid, with no separate `publicId` field.
- [ ] **Events:** `order.created` / `order.paid` / `order.failed` drop `orderId`, `userId`, `offerId` ints and get `orderPublicId`, `buyerPublicId`, `offerPublicId`; the order consumers and SSE (`order-notify-events.gateway`) get a tolerant reader.
- [ ] **Tests:** `order.e2e`, `order-realtime.e2e`, `order-notify-events.gateway.spec`, the order message service specs.

---

## Pass 4. Documenting the rules

- [ ] **AGENTS.md:** the two tables from the top of this plan, "a person's uuid is born in identity", the exceptions (associations, infrastructure), and "a contract change means a tolerant reader for old Kafka events".
- [ ] **README:** the "Bounded contexts" section (the arrows and the "Plain ids across contexts" paragraph are now outdated), the Temporal note, the `POST /order` example.

---

## Throughout

- **One commit = one step:** a migration with `up` / `down`, code, tests, a green `test:all`, `tsc`, lint, and a manual check on the running dev stack (`migrate` on real data, one order placed end to end).
- **Migrations backfill, they don't drop.** Every new column gets filled from existing rows before `NOT NULL` or a constraint is added, so the dev data and the Kafka history survive.
- **`test/support/migrations.ts`:** register every new migration.
- **`seed.ts`** follows each step, because it creates rows by the old keys.
- **Old events:** every consumer of a changed contract gets a test with an old-format event.

| Risk | What we do |
|---|---|
| Workflows still running with the old input | drain or terminate them before 1.3 and 2.2; a note in the README |
| Old events replayed from Kafka | tolerant reader + a test |
| `ON CONFLICT` changes key | integration tests on `credit` / `createIfAbsent` / `claim` |
| Changing the PK of `Account` / `OrderBuyer` with live FKs | drop the FK, move the PK, recreate the FK, all in one migration (DDL in Postgres is transactional) |

**Size:** 9 commits (1.1–1.4, 2.1–2.3, 3, 4). The heaviest are 1.3 (order + Temporal + CASL) and 2.2 (stock contracts).
