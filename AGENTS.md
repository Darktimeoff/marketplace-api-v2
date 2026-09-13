# AGENTS.md

Conventions for this repo, derived from the existing modules (`order`, `background-job`, `phone`, `delivery-address`, `product-offer`). Follow the same shape for any new domain module.

## Module layout

Each domain lives under `src/<domain>/` with its own `<domain>.module.ts` and subfolders:

```
src/<domain>/
  <domain>.module.ts
  controller/<domain>.controller.ts   (only if the domain is exposed over HTTP)
  dto/<domain>.dto.ts                 (only alongside a controller)
  input/<domain>-create.input.ts
  input/<domain>-update.input.ts      (when updates are supported)
  entity/<domain>.entity.ts           (or src/entities/<name>.entity.ts for entities with no owning module)
  repository/<domain>.repository.ts
  service/<domain>.service.ts
```

A module's `imports` registers only the entities it owns via `TypeOrmModule.forFeature([...])`, plus any other domain modules whose services it needs (e.g. `OrderModule` imports `PhoneModule`, `DeliveryAddressModule`, `ProductOfferModule`). Entities with no owning module stay in `src/entities/all.ts` and are picked up by `autoLoadEntities` in `DBModule`.

## Layer responsibilities

**Controller** (`controller/`)
- Only in modules exposing an HTTP API.
- Accepts an `input` class (validated by the global `ValidationPipe`), delegates to the service, returns whatever the service returns.
- No business logic, no direct repository/entity access.
- Marks the response shape with `@ResponseDto(SomeDto)` — the DTO for the *response*, distinct from the `input` used for the request body. See `order.controller.ts` + `order.dto.ts`.

**DTO** (`dto/*.dto.ts`)
- Controller-level output contract only. `@Expose()` + `class-validator` decorators per field; the `ValidationResponseInterceptor` runs `plainToInstance` + `validateSync` against it before the response leaves the controller.
- Never used as an input type, and never imported by services/repositories.

**Input** (`input/*-create.input.ts`, `*-update.input.ts`)
- Controller-level request contract, validated by `class-validator` decorators (`@IsInt`, `@IsString`, `@ValidateNested`, etc.).
- Nested payloads use `@Type(() => NestedInput)` + `@ValidateNested()` (see `OrderCreateInput`).
- Passed straight into the service method with the same name pattern (`create(input: XCreateInput)`).

**Service** (`service/`)
- All business logic and orchestration lives here: coordinating multiple repositories, calling other domains' services, computing derived values (pricing, totals), enforcing invariants that aren't plain DB constraints.
- Wrap multi-step writes in `@Transactional()` (see `OrderService.create`).
- Talks only to repositories and other services — never touches `TransactionHost`/`Repository` directly, never imports `input`/`dto` types from other domains beyond what it needs as parameters.
- One comment above a method only when the "why" isn't obvious from the code (e.g. why a snapshot row is always created new, why a status can't be set from the input).

**Repository** (`repository/`)
- Only layer that touches TypeORM. Injects `TransactionHost<TransactionalAdapterTypeOrm>` (from `@nestjs-cls/transactional`) and calls `this.txHost.tx.getRepository(Entity)` per method — **do not** use `@InjectRepository`/`Repository<T>` constructor injection, even though the entity is also registered via `TypeOrmModule.forFeature([...])` in the module (that registration is only for entity discovery/`autoLoadEntities`, not for DI here).
- Exposes `create`/`update`/query methods typed against an entity-level interface, not the controller's `input` type:
  ```ts
  export interface XCreateEntityInterface extends Pick<X, 'field1' | 'field2'> {}
  ```
  defined at the bottom of the entity file (see `OrderCreateEntityInterface`, `BackgroundJobCreateEntityInterface`, `OrderProductCreateEntityInterface`). The service maps the validated `input` (plus any derived/computed fields) into this interface before calling the repository.
- Method bodies are thin: `getRepository(Entity)`, then `create`/`save`/`find*` — no branching business logic.

## Entities

- One file per entity under `src/entities/*.entity.ts`, or under `<domain>/entity/*.entity.ts` once a domain module owns it.
- `@Check(...)` constraints for invariants the DB should enforce (blank strings, date ordering, non-negative numbers) instead of only validating them in TypeScript.
- `@ManyToOne`/`@OneToOne` `onDelete` is chosen deliberately per relation (`CASCADE` for compositions that can't outlive their parent, `RESTRICT` for historical/snapshot data) — comment the reasoning when it isn't obvious.
- A comment on the entity only when a design decision needs explaining (e.g. why a field is unique, why jsonb over json, why a natural key exists for dedup).

## Data source / migrations

- `src/data-source.ts` is a standalone CLI script (used by `migration:generate`) — it cannot use `autoLoadEntities`, so it manually lists every entity: the shared list from `entities/all.ts` plus every entity owned by a feature module. When adding a new owned entity, add it there too, or `migration:generate` won't see its table.
