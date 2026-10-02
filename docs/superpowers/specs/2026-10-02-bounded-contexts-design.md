# Bounded contexts: ownership, references and naming

Date: 2026-10-02
Status: approved design, pending implementation plan

## Goal

Make every module a bounded context that could be extracted into its own service without rewriting its model:

- every table is owned by exactly one context;
- a context references another context's data by plain id only, never by foreign key;
- data one context needs from another at a point in time is copied (snapshot), not shared;
- every context uses names from its own ubiquitous language.

Scope is strategic DDD plus naming. Code structure inside a module (controllers, gateways, command handlers, services, repositories, TypeORM entities as the model) does not change.

## Contexts and ownership

| Context | Owns |
|---|---|
| identity | `Identity`, with the login phone as a value object |
| user | `User`, `Address` (address book) |
| catalog | `Product`, `ProductTranslation`, `ProductVariant`, `Category`, `CategoryTranslation`, `Brand`, `BrandTranslation` |
| seller | `Seller`, `SellerOffer`, `StockReservation` |
| order | `Order`, `OrderRecipient`, `OrderLine` |
| account | `Account`, `Transaction`, `AccountInbox` |

Context map (an arrow means "holds an id of"):

```
identity ◄── user ◄──── order ───► seller ───► catalog
                          │
                          └──────► account
```

## Decisions

1. Identity is its own context, separate from user. The login phone belongs to identity.
2. The person who places an order is referenced as `Order.userId`, the user's id. The reference moves from `OrderRecipient.buyerId` to `Order`.
3. Account keeps `customerId`. Order maps `order.userId` to `customerId` when it sends the charge and refund messages. Both contexts name the same person in their own language.
4. `OrderRecipient` is the delivery contact snapshot only: `fullName`, a phone value object and an address value object, written once at checkout. It holds no id of another context.
5. `Transaction` keeps its name.
6. Value objects are TypeORM embedded columns, not tables: ordinary typed columns with their own constraints, not JSON.
7. `OrderRecipient` stays a separate table rather than being folded into `Order`, leaving room for per-seller shipments with their own recipient.
8. Contract packages contain only the published language: what crosses a context boundary (HTTP requests and responses, messages, and the enums those use). A context's entities, internal enums and repository types stay inside the context. Entity interfaces are removed from `@marketplace/contracts-core`; ORM entity classes are each context's model and implement no shared interface.

## Naming changes

| Context | Now | After | Reason |
|---|---|---|---|
| identity | `Identity.phoneId` → `Phone` | `Identity.loginPhone` (value object) | a credential attribute, not a shared entity |
| user | `DeliveryAddress` | `Address` | an address-book entry; delivery is one use of it |
| user | `User.deliveryAddressId` | `User.addressId` | follows the entity name |
| seller | `SellerOffer.quantity` | `SellerOffer.onHandQuantity` | unambiguous next to `reservedQuantity` |
| order | `OrderRecipient.buyerId` | `Order.userId` | the user belongs on the order, not on the delivery contact |
| order | `OrderProduct` | `OrderLine` | a line of the order, not a product |
| order | `OrderProduct.price`, `discountPrice` | `OrderLine.unitPrice`, `unitDiscountPrice` | per-unit prices at purchase time |

Unchanged: `Identity`, `User`, `Product`, `ProductVariant`, `Category`, `Brand`, `SellerOffer`, `StockReservation`, `Order`, `OrderRecipient`, `Account`, `Account.customerId`, `Transaction`, `AccountInbox`.

## References between contexts

Every cross-context reference becomes a plain id with no foreign key:

| Reference | Before | After |
|---|---|---|
| `User.identityId` → identity | FK | plain id |
| `Seller.userId` → user | FK | plain id |
| `SellerOffer.variantId` → catalog | FK | plain id |
| `Order.userId` → user | `OrderRecipient.buyerId` with FK | plain id on `Order` |
| `OrderLine.offerId` → seller | FK | plain id |
| `Account.customerId` | plain id | unchanged |

Foreign keys inside a context stay: `User → Address`; the catalog's internal FKs; `SellerOffer → Seller`, `StockReservation → SellerOffer`; `Order → OrderRecipient`, `OrderLine → Order`; `Transaction → Account`.

The ORM relations behind each dropped FK are removed as well (`@ManyToOne` and the matching inverse side), because a TypeORM relation creates the FK. The id columns stay as integers.

## Schema migrations

One hand-written migration per context. Each `down` restores the exact previous state. All of them must succeed inside the single transaction TypeORM uses for pending migrations on a fresh database; none adds an enum value.

1. **`OrderOwnsUserAndContact`** (order)
   - `Order.userId integer NOT NULL`, back-filled from `OrderRecipient.buyerId` through `Order.orderRecipientId`.
   - `OrderRecipient` gains `phoneCountryCode` (`CountryCodeEnum`), `phoneRawNumber varchar(32)`, `phoneFullNumber varchar(16)` with the E.164 CHECK, `phoneNationalNumber varchar(15)` with the format CHECK, `addressLine varchar(255)`, `addressCity varchar(100)`, `addressBuilding varchar(32) NULL`, back-filled from the joined `Phone` and `DeliveryAddress` rows, then set `NOT NULL` except `addressBuilding`.
   - `OrderRecipient` drops `buyerId`, `phoneId`, `deliveryAddressId` with their FKs and unique constraints.
   - The `Phone` and `DeliveryAddress` rows that only recipients referenced are deleted (none is shared with `Identity` or `User`).
2. **`IdentityOwnsLoginPhone`** (identity), after 1
   - `Identity` gains nullable `loginPhoneCountryCode`, `loginPhoneRawNumber`, `loginPhoneFullNumber`, `loginPhoneNationalNumber` with the same CHECKs, back-filled from `Phone`.
   - `Identity_login_present` becomes `"email" IS NOT NULL OR "loginPhoneFullNumber" IS NOT NULL`.
   - `Identity.phoneId` and its FK are dropped, then the `Phone` table.
3. **`RenameDeliveryAddressToAddress`** (user)
   - Table `DeliveryAddress` → `Address` with its PK, CHECK and trigger names; `User.deliveryAddressId` → `addressId`.
   - `User_identityId_fkey` is dropped.
4. **`RenameOrderProductToOrderLine`** (order)
   - Table `OrderProduct` → `OrderLine` with its PK, CHECK and FK names; `price` → `unitPrice`, `discountPrice` → `unitDiscountPrice`.
   - The FK `offerId → SellerOffer` is dropped.
5. **`RenameOnHandQuantity`** (seller)
   - `SellerOffer.quantity` → `onHandQuantity`; `SellerOffer_quantity_nonneg` renamed to match.
   - `SellerOffer_variantId_fkey` and `Seller_userId_fkey` are dropped.

## Code and contracts

**Modules**

- `src/phone/` is deleted.
- `src/delivery-address/` is deleted; `Address` moves to `src/user/entity/address.entity.ts`. Its service, repository and input had no user besides order and are removed.
- Embeddable classes live in a `value-object/` folder: `src/order/value-object/recipient-phone.value-object.ts`, `src/order/value-object/recipient-address.value-object.ts`, `src/identity/value-object/login-phone.value-object.ts`.
- Order: `OrderProduct` → `OrderLine` (`order-line.entity.ts`, `OrderLineRepository`, `OrderLineCreateEntityInterface`), relation `Order.items` → `Order.lines`, `PricedOrderItem` → `PricedOrderLine`.
- Seller: `quantity` → `onHandQuantity` in the entity, the reserve SQL and the rejection's available stock.

**Contracts (`@marketplace/contracts-core`)**

Stage 0 reduces the package to the published language (decision 8):

- Removed: all 20 entity interfaces (`<module>/entity/*-entity.interface.ts`); every ORM entity drops its `implements` clause.
- Moved back into their context (as `src/<module>/enum/<name>.enum.ts`): `TransactionTypeEnum`, `TransactionStatusEnum` (account), `StockReservationStatusEnum` (seller-offer), `RoleEnum` (identity), `GenderEnum` (user).
- Kept: `OrderStatusEnum`, `CurrencyEnum`, `CountryCodeEnum` (used by requests, responses or messages) and `LanguageEnum` (shared kernel value used by catalog and user).
- `OrderResponseInterface` becomes a standalone interface with its own fields instead of `Pick<OrderEntityInterface, …>`.
- The request interfaces stay.

Later stages:

- `CountryCodeEnum` moves from `phone/enum/` to `generic/enum/` (stage 2, when the phone domain disappears).
- Removed: `PhoneCreateRequestInterface`, `DeliveryAddressCreateRequestInterface` (stages 1 and 3).
- The order request gets its own nested phone and address request interfaces, `OrderCreateRecipientPhoneRequestInterface` and `OrderCreateRecipientAddressRequestInterface` (stage 1).
- `@marketplace/messaging-contracts` is unchanged.

**Order behaviour**

- `OrderPlaceCommandHandler.createPending` writes the recipient with its phone and address directly in its own transaction and no longer creates data through other modules.
- `OrderAccessService` checks ownership against `Order.userId`, for the status update and the SSE stream.

**HTTP API**

`POST /order` body:

```json
{
  "userId": 4,
  "recipient": { "fullName": "…", "phone": { … }, "address": { … } },
  "items": [ … ],
  "currency": "UAH"
}
```

`recipient.buyerId` is replaced by top-level `userId`, and `recipient.deliveryAddress` is renamed `recipient.address`. The response is unchanged.

## Delivery

Stage 0 changes code only. Every other stage is one migration with its code, contracts and tests. Each stage is verified and committed on its own; the app works after every commit.

| # | Stage | Commit |
|---|---|---|
| 0 | Contracts keep only the published language: entity interfaces removed, single-context enums moved into their contexts, `OrderResponseInterface` standalone; no migration | `refactor: keep entity interfaces in contexts` |
| 1 | Order owns its user reference and recipient contact; new request body | `refactor: snapshot recipient contact on order` |
| 2 | Identity owns its login phone; `phone` module and `Phone` table removed | `refactor: embed login phone in identity` |
| 3 | `Address` moves into user; `delivery-address` module removed; `User.identityId` FK dropped | `refactor: move address into user` |
| 4 | `OrderProduct` → `OrderLine`, unit prices; `offerId` FK dropped | `refactor: rename order product to line` |
| 5 | `onHandQuantity`; `variantId` and `Seller.userId` FKs dropped | `refactor: rename on hand quantity` |
| 6 | README domain section; local `AGENTS.md` naming and contracts rules | `chore: document bounded contexts` |

## Verification

Every stage:

- type-check, build, lint, unit tests;
- integration and e2e suites on a fresh database (all migrations in one transaction);
- `migrate:revert` then `migrate` on the dev database with identical `pg_dump --schema-only` and row counts;
- back-filled values equal their source rows;
- `migrate:generate` shows only the known pre-existing drift;
- the seed runs twice with the same result.

Stage 0 has no migration, so it skips the migration, back-fill and drift steps. It adds a check that `@marketplace/contracts-core` exports no `*EntityInterface`, and that no file imports an enum from another context's `src/<module>/enum/`.

Stages 1, 4 and 5 also run the order flows against the app: success → `paid`, out of stock → `canceled`, charge refused → `failed_payment`, failure after the charge → refunded and released, SSE ownership through `Order.userId`.

After stage 5, a query over `pg_constraint` lists every FK and confirms none crosses a context.

## Risks

- Stages 1 and 2 move data and delete rows; each `down` re-creates the rows from the copies and is verified by the round-trip on the dev data before committing.
- The request body change in stage 1 breaks old callers; the e2e test, README quick start, seed and the local Insomnia collection change in the same stage.
- Without cross-context FKs the database no longer stops a reference to a deleted row in another context. Order validates offers at checkout, and order lines keep snapshotted prices.

## Out of scope

Tactical DDD (separate domain layer, aggregate methods, domain events, mappers), a gRPC transport for the pricing read, the asynchronous saga, and Kafka.
