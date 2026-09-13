-- Seed: реалистичный объём для EXPLAIN.
-- Главная таблица — "Order", 120 000 строк.
-- id вставляются явно через OVERRIDING SYSTEM VALUE, чтобы FK ссылались
-- детерминированно; в конце sequence'ы перематываются на max(id).
-- Распределения перекошенные: статусы, активность покупателей, число позиций.

BEGIN;

SET LOCAL synchronous_commit = off;

-- ---------- справочники ----------

-- 40 категорий: 8 корневых + 32 дочерних
INSERT INTO "Category" ("id", "slug", "parentCategoryId") OVERRIDING SYSTEM VALUE
SELECT n, 'category-' || n, NULL
FROM generate_series(1, 8) AS n;

INSERT INTO "Category" ("id", "slug", "parentCategoryId") OVERRIDING SYSTEM VALUE
SELECT n, 'category-' || n, 1 + ((n - 9) % 8)
FROM generate_series(9, 40) AS n;

INSERT INTO "CategoryTranslation" ("categoryId", "name", "language")
SELECT c."id", 'Category ' || c."id", l."lang"::"LanguageEnum"
FROM "Category" c
CROSS JOIN (VALUES ('en'), ('ua')) AS l("lang");

-- 200 брендов
INSERT INTO "Brand" ("id", "slug") OVERRIDING SYSTEM VALUE
SELECT n, 'brand-' || n FROM generate_series(1, 200) AS n;

INSERT INTO "BrandTranslation" ("brandId", "name", "language")
SELECT b."id", 'Brand ' || b."id", l."lang"::"LanguageEnum"
FROM "Brand" b
CROSS JOIN (VALUES ('en'), ('ua')) AS l("lang");

-- ---------- пользователи: 10 000 ----------
-- Телефоны 1..10000 — профильные, 10001..130000 — снапшоты получателей.
INSERT INTO "Phone" ("id", "countryCode", "rawNumber", "fullNumber", "nationalNumber")
OVERRIDING SYSTEM VALUE
SELECT n,
       'UA'::"CountryCodeEnum",
       '0' || lpad(n::text, 8, '0'),
       '+380' || lpad(n::text, 9, '0'),
       lpad(n::text, 9, '0')
FROM generate_series(1, 10000) AS n;

INSERT INTO "DeliveryAddress" ("id", "addressLine", "city", "building")
OVERRIDING SYSTEM VALUE
SELECT n,
       'Street ' || (n % 500) || ', apt ' || (n % 90 + 1),
       (ARRAY['Kyiv', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro'])[1 + (n % 5)],
       (n % 200 + 1)::text
FROM generate_series(1, 10000) AS n;

INSERT INTO "Identity" ("id", "email", "phoneId", "passwordHash", "role", "activatedAt", "createdAt")
OVERRIDING SYSTEM VALUE
SELECT n,
       'user' || n || '@example.com',
       n,
       '$2b$10$' || md5(n::text) || md5((n * 7)::text),
       -- перекос по ролям: 1 owner, 20 admin, 200 seller, остальные user
       CASE
         WHEN n = 1 THEN 'owner'
         WHEN n <= 21 THEN 'admin'
         WHEN n <= 221 THEN 'seller'
         ELSE 'user'
       END::"RoleEnum",
       -- 5% так и не активировались
       CASE WHEN n % 20 = 0 THEN NULL ELSE now() - (n % 700) * interval '1 day' END,
       now() - (n % 700) * interval '1 day' - interval '1 hour'
FROM generate_series(1, 10000) AS n;

INSERT INTO "User" ("id", "identityId", "firstName", "lastName", "dateOfBirth",
                    "gender", "language", "timezone", "deliveryAddressId", "createdAt")
OVERRIDING SYSTEM VALUE
SELECT n,
       n,
       -- 3% профилей ещё без имени: регистрация прошла, профиль не заполнен
       CASE WHEN n % 33 = 0 THEN NULL ELSE (ARRAY['Ivan','Olha','Petro','Maria','Andrii','Kateryna'])[1 + (n % 6)] END,
       CASE WHEN n % 33 = 0 THEN NULL ELSE (ARRAY['Shevchenko','Kovalenko','Bondarenko','Tkachenko'])[1 + (n % 4)] END,
       (date '1995-01-01' - (n % 9000) * interval '1 day')::date,
       CASE WHEN n % 2 = 0 THEN 'male' ELSE 'female' END::"GenderEnum",
       -- перекос: 80% ua
       CASE WHEN n % 5 = 0 THEN 'en' ELSE 'ua' END::"LanguageEnum",
       'Europe/Kyiv',
       n,
       now() - (n % 700) * interval '1 day' - interval '1 hour'
FROM generate_series(1, 10000) AS n;

-- ---------- товары: 20 000 ----------
INSERT INTO "Product" ("id", "categoryId", "brandId", "slug") OVERRIDING SYSTEM VALUE
SELECT n, 9 + (n % 32), 1 + (n % 200), 'product-' || n
FROM generate_series(1, 20000) AS n;

-- Заголовки в естественном регистре — под запрос q3 с lower()
INSERT INTO "ProductTranslation" ("productId", "title", "description", "language")
SELECT n,
       (ARRAY['Apple MacBook Pro 14', 'Samsung Galaxy S24', 'Sony WH-1000XM5',
              'Dell XPS 13', 'Logitech MX Master 3S'])[1 + (n % 5)] || ' ' || n,
       'Description for product ' || n,
       'en'::"LanguageEnum"
FROM generate_series(1, 20000) AS n;

INSERT INTO "ProductTranslation" ("productId", "title", "description", "language")
SELECT n, 'Товар ' || n, 'Опис товару ' || n, 'ua'::"LanguageEnum"
FROM generate_series(1, 20000) AS n;

-- ---------- офферы: 60 000 (продавцы — id 22..221) ----------
INSERT INTO "ProductOffer" ("id", "productId", "sellerId", "sku", "price", "currency", "discountPrice")
OVERRIDING SYSTEM VALUE
SELECT n,
       1 + (n % 20000),
       22 + (n % 200),
       'SKU-' || n,
       round((50 + (n % 45000) / 10.0)::numeric, 2),
       -- перекос по валютам: 85% UAH
       CASE WHEN n % 20 = 0 THEN 'USD' WHEN n % 13 = 0 THEN 'EUR' ELSE 'UAH' END::"CurrencyEnum",
       -- скидка лишь у ~15% офферов, остальные NULL
       CASE WHEN n % 7 = 0
            THEN round(((50 + (n % 45000) / 10.0) * 0.85)::numeric, 2)
            ELSE NULL
       END
FROM generate_series(1, 60000) AS n;

-- ---------- снапшоты получателей: 120 000 ----------
-- Телефон и адрес — новые строки, скопированные с профиля покупателя.
INSERT INTO "Phone" ("id", "countryCode", "rawNumber", "fullNumber", "nationalNumber")
OVERRIDING SYSTEM VALUE
SELECT 10000 + n,
       'UA'::"CountryCodeEnum",
       '0' || lpad((10000 + n)::text, 8, '0'),
       '+380' || lpad((10000 + n)::text, 9, '0'),
       lpad((10000 + n)::text, 9, '0')
FROM generate_series(1, 120000) AS n;

INSERT INTO "DeliveryAddress" ("id", "addressLine", "city", "building")
OVERRIDING SYSTEM VALUE
SELECT 10000 + n,
       'Street ' || (n % 500) || ', apt ' || (n % 90 + 1),
       (ARRAY['Kyiv', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro'])[1 + (n % 5)],
       (n % 200 + 1)::text
FROM generate_series(1, 120000) AS n;

-- Покупатели перекошены: 20% пользователей делают 80% заказов.
INSERT INTO "OrderRecipient" ("id", "buyerId", "fullName", "phoneId", "deliveryAddressId", "createdAt")
OVERRIDING SYSTEM VALUE
SELECT n,
       CASE WHEN n % 5 = 0
            THEN 222 + (n % 9779)          -- «длинный хвост» редких покупателей
            ELSE 222 + (n % 1956)          -- активное ядро
       END,
       (ARRAY['Ivan','Olha','Petro','Maria','Andrii'])[1 + (n % 5)] || ' ' ||
       (ARRAY['Shevchenko','Kovalenko','Bondarenko','Tkachenko'])[1 + (n % 4)],
       10000 + n,
       10000 + n,
       now() - (n % 730) * interval '1 day'
FROM generate_series(1, 120000) AS n;

-- ---------- заказы: 120 000 ----------
-- Статусы перекошены как в жизни: терминальные состояния доминируют,
-- failed_payment ~0.7% — именно под него строится partial-индекс в q2.
INSERT INTO "Order" ("id", "orderRecipientId", "status", "totalAmount", "discountAmount", "currency", "createdAt")
OVERRIDING SYSTEM VALUE
SELECT n,
       n,
       CASE
         WHEN r < 0.600 THEN 'completed'
         WHEN r < 0.750 THEN 'delivered'
         WHEN r < 0.830 THEN 'paid'
         WHEN r < 0.880 THEN 'shipped'
         WHEN r < 0.930 THEN 'canceled'
         WHEN r < 0.960 THEN 'confirmed'
         WHEN r < 0.980 THEN 'preparing'
         WHEN r < 0.990 THEN 'pending_payment'
         WHEN r < 0.997 THEN 'failed_payment'
         WHEN r < 0.999 THEN 'created'
         ELSE 'refunded'
       END::"StatusEnum",
       round((120 + (n % 90000) / 10.0)::numeric, 2),
       CASE WHEN n % 9 = 0 THEN round(((n % 500) / 10.0)::numeric, 2) ELSE 0 END,
       CASE WHEN n % 20 = 0 THEN 'USD' WHEN n % 13 = 0 THEN 'EUR' ELSE 'UAH' END::"CurrencyEnum",
       now() - (n % 730) * interval '1 day' + (n % 86400) * interval '1 second'
FROM (SELECT n, random() AS r FROM generate_series(1, 120000) AS n) AS s;

-- ---------- позиции заказов: ~230 000 ----------
-- Число позиций перекошено: у большинства заказов 1-2 позиции, у части — 4.
INSERT INTO "OrderProduct" ("orderId", "productOfferId", "quantity", "price", "discountPrice", "createdAt")
SELECT o."id",
       1 + ((o."id" * 7 + i * 104729) % 60000),
       1 + ((o."id" + i) % 3),
       round((100 + ((o."id" + i) % 50000) / 10.0)::numeric, 2),
       CASE WHEN (o."id" + i) % 7 = 0
            THEN round(((100 + ((o."id" + i) % 50000) / 10.0) * 0.9)::numeric, 2)
            ELSE NULL
       END,
       o."createdAt"
FROM "Order" o
CROSS JOIN LATERAL generate_series(
  1,
  CASE WHEN o."id" % 10 < 6 THEN 1 WHEN o."id" % 10 < 9 THEN 2 ELSE 4 END
) AS i
ON CONFLICT ("orderId", "productOfferId") DO NOTHING;

-- ---------- перемотка sequence'ов после явных id ----------
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'Phone', 'DeliveryAddress', 'Identity', 'User', 'Brand', 'BrandTranslation',
    'Category', 'CategoryTranslation', 'Product', 'ProductTranslation',
    'ProductOffer', 'OrderRecipient', 'Order'
  ] LOOP
    EXECUTE format(
      'SELECT setval(pg_get_serial_sequence(%L, ''id''), COALESCE((SELECT max("id") FROM %I), 1), true)',
      quote_ident(tbl), tbl
    );
  END LOOP;
END $$;

COMMIT;

-- VACUUM (ANALYZE), а не просто ANALYZE: статистику даёт ANALYZE, но visibility map
-- выставляет именно VACUUM. Без неё Index Only Scan всё равно лезет в кучу
-- (Heap Fetches в плане) и buffers «после» деградируют на порядок.
VACUUM (ANALYZE);
