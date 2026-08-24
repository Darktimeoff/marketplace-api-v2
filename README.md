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
| catalog    | `GET /catalog/category/{id}` — category + breadcrumbs + a cursor-paginated page of products  | `getCatalogByCategory` |
| products   | `POST /products` — create a product (Idempotency-Key)                                        | `createProduct`        |
| products   | `GET /products/{id}` — product + breadcrumbs                                                 | `getProduct`            |

All responses (2xx and 4xx) use a single `{ data, error }` envelope: on
success `data` is populated and `error: null`; on failure `data: null` and
`error` is a `Problem` object. **Deliberate trade-off:** because of this,
the `application/problem+json` body is not a "flat" RFC 7807 object — it's
wrapped as `{ data: null, error: Problem }`, in favor of one uniform
response shape for the client across every endpoint.

Cursor pagination lives on `GET /catalog/category/{id}`: query parameters
`limit`, `cursor` (opaque token), response contains `data.products[]` and
`data.pagination.next_cursor` (nullable; `null` = no more pages).

## Visualizing the spec

```bash
npm run docs
```

Generates `docs.html` (Redoc) with interactive documentation — open it in a browser.

## Install

```bash
npm install
```

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
grep -c 'next_cursor' openapi/openapi.yaml

# 5. problem+json is used for every error
grep -c 'application/problem+json' openapi/openapi.yaml

# 6. Contract test part (option A): the consumer test produces pacts/*.json
npm run test:contract
ls pacts/*.json
```

All commands pass right after `npm install`, with no extra manual steps.
