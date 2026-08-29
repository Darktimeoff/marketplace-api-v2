# marketplace-api-v2

Course project homework #1: OpenAPI contract for the Marketplace API
(`openapi/openapi.yaml`) + contract test part.

**Chosen contract-test option: A — consumer-driven Pact.**

## Resources and operations

| Resource   | Operation                                                                                   | operationId            |
|------------|-----------------------------------------------------------------------------------------------|-------------------------|
| category   | `GET /category` — category tree                                                              | `listCategoryTree`     |
| category   | `POST /category` — create a category                                                         | `createCategory`       |
| category   | `GET /category/{id}` — subtree by id                                                         | `getTreeById`           |
| catalog    | `GET /catalog/category/{id}` — breadcrumbs + a cursor-paginated page of products              | `getCatalogByCategory` |
| products   | `POST /product` — create a product (Idempotency-Key)                                        | `createProduct`        |
| products   | `GET /product/{id}` — product + breadcrumbs                                                 | `getProduct`            |

All responses (2xx and 4xx) use a single `{ data, error }` envelope: on
success `data` is populated and `error: null`; on failure `data: null` and
`error` is a `Problem` object. **Deliberate trade-off:** because of this,
the `application/problem+json` body is not a "flat" RFC 7807 object — it's
wrapped as `{ data: null, error: Problem }`, in favor of one uniform
response shape for the client across every endpoint.

Cursor pagination lives on `GET /catalog/category/{id}`: query parameters
`limit`, `cursor` (opaque token), response contains `data.products[]` and
`data.pagination.nextCursor` (nullable; `null` = no more pages).

**Naming trade-off:** all multi-word JSON fields use camelCase
(`nextCursor`, `prevCursor`, `hasMore`, `totalCount`, `priceCents`) for
consistency with the rest of the API, instead of the snake_case
(`next_cursor`) used in the original assignment example — a deliberate
choice for this project.

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
(`src/generic/config/config-environment.schema.ts`) — the app exits
immediately with a validation error if any are missing or invalid.

| Variable  | Required | Default | Description                          |
|-----------|----------|---------|---------------------------------------|
| `PORT`    | no       | `3000`  | HTTP port the Nest app listens on     |
| `DBHOST`  | yes      | —       | Postgres host                         |
| `DBPORT`  | no       | `3000`  | Postgres port (host-mapped, see `docker-compose.yml`) |
| `DBUSER`  | yes      | —       | Postgres role/user                    |
| `DBNAME`  | yes      | —       | Postgres database name                |

The database password is **not** an environment variable — it's read from
`secrets/db_password.txt` (git- and docker-ignored; only `secrets/*.example`
templates are tracked). `docker-compose.yml` feeds the same file to Postgres
via `POSTGRES_PASSWORD_FILE`, so both the app and the database read one
shared secret.

`.env.example` mirrors the schema and is checked against it in CI/locally:

```bash
npm run check:env   # fails with exit 1 if .env.example drifts from the schema
```

### Running locally

```bash
cp .env.example .env                        # fill in real values
cp secrets/db_password.txt.example secrets/db_password.txt   # then edit it

docker compose up -d db                     # start Postgres
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
