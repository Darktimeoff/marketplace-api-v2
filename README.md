# marketplace-api-v2

Домашнє завдання №1 курсового проєкту: OpenAPI-контракт Marketplace API
(`openapi/openapi.yaml`) + contract-частина.

**Обраний варіант contract-частини: А — consumer-driven Pact.**

## Ресурси та операції

| Ресурс     | Операція                                          | operationId          |
|------------|----------------------------------------------------|-----------------------|
| category   | `GET /category` — дерево категорій                 | `listCategoryTree`   |
| category   | `POST /category` — створити категорію               | `createCategory`     |
| category   | `GET /category/{id}` — піддерево за id              | `getTreeById`         |
| catalog    | `GET /catalog/category/{id}` — категорія + breadcrumbs + cursor-пагінована сторінка товарів | `getCatalogByCategory` |
| products   | `POST /products` — створити товар (Idempotency-Key) | `createProduct`      |
| products   | `GET /products/{id}` — товар + breadcrumbs          | `getProduct`          |

Усі відповіді (2xx і 4xx) використовують єдину обгортку `{ data, error }`:
на успіху `data` заповнено, `error: null`; на помилці `data: null`, а
`error` — це `Problem`-об'єкт. **Свідомий trade-off:** через це
`application/problem+json`-тіло не є "плоским" RFC 7807 обʼєктом, а
обгорнуте в `{ data: null, error: Problem }` — заради єдиної форми
відповіді для клієнта на всіх ендпойнтах.

Cursor-пагінація — на `GET /catalog/category/{id}`: query-параметри
`limit`, `cursor` (opaque-токен), відповідь містить `data.products[]` та
`data.paginator.next_cursor` (nullable; `null` = сторінок більше немає).

## Візуалізація спеки

```bash
npm run docs
```

Генерує `docs.html` (Redoc) з інтерактивною документацією — відкрити у браузері.

## Встановлення

```bash
npm install
```

## Перевірки (acceptance criteria)

```bash
# 1. Спека валідна (exit code 0, security-defined закрито через security: [])
npx @redocly/cli lint openapi/openapi.yaml

# 2. Обсяг спеки: ≥2 ресурси, ≥5 операцій, Idempotency-Key required + опис ≥40 символів
npx @redocly/cli bundle openapi/openapi.yaml -o spec.json
node -e "const s=require('./spec.json'),M=['get','post','put','patch','delete'];\
const ops=Object.entries(s.paths).flatMap(([p,v])=>Object.keys(v).filter(m=>M.includes(m)).map(m=>[p,m]));\
const idem=ops.flatMap(([p,m])=>s.paths[p][m].parameters??[]).find(x=>x.in==='header'&&/idempotency-key/i.test(x.name));\
console.log('операцій:',ops.length,'· ресурсів:',new Set(Object.keys(s.paths).map(p=>p.split('/')[1])).size);\
console.log('Idempotency-Key: required =',idem?.required,'· опис, символів =',(idem?.description??'').trim().length)"

# 3. Idempotency-Key задекларовано
grep -c 'Idempotency-Key' openapi/openapi.yaml

# 4. Cursor-пагінація у контракті
grep -c 'next_cursor' openapi/openapi.yaml

# 5. problem+json скрізь у помилках
grep -c 'application/problem+json' openapi/openapi.yaml

# 6. Contract-частина (варіант А): тест консюмера створює pacts/*.json
npm run test:contract
ls pacts/*.json
```

Усі команди проходять одразу після `npm install`, без додаткових ручних
кроків.
