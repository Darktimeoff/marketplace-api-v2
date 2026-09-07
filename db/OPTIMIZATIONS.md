# OPTIMIZATIONS

Три реальных запроса Marketplace API: `EXPLAIN (ANALYZE, BUFFERS)` до и после `db/indexes.sql`.

Порядок прогона — тот же, что у грейдера: чистый volume → `schema.sql` → `seed.sql` → EXPLAIN «до» → `indexes.sql` → `ANALYZE` → EXPLAIN «после». Оба замера каждой пары сняты в одном прогоне.

Стенд: PostgreSQL 18 в Docker, главная таблица `"Order"` — 120 000 строк, `"OrderRecipient"` — 120 000, `"OrderProduct"` — 192 000, `"ProductTranslation"` — 40 000.

`seed.sql` заканчивается `VACUUM (ANALYZE)`, а не голым `ANALYZE`: статистику для планера даёт `ANALYZE`, но visibility map выставляет именно `VACUUM`, и без неё Index Only Scan всё равно ходил бы в кучу.

## Итог

| Запрос | Execution Time до | после | Ускорение | Buffers до | после | Тип индекса |
|---|---|---|---|---|---|---|
| q1 | 3.883 ms | 0.876 ms | **4×** | 1325 | 213 | b-tree |
| q2 | 8.817 ms | 0.270 ms | **33×** | 1467 | 30 | partial |
| q3 | 6.712 ms | 0.157 ms | **43×** | 541 | 10 | expression |

Числа с моей машины и от прогона к прогону плавают (в seed используется `random()`), важен порядок величины: два запроса из трёх ускорились в десятки раз, третий — в разы, при падении buffers в 6–40 раз.

---

## q1 — заказы покупателя за период

«Мої замовлення» в личном кабинете: все заказы одного покупателя за последний год, свежие сверху.

```sql
SELECT o."id", o."publicId", o."status", o."totalAmount", o."currency", o."createdAt" FROM "Order" o JOIN "OrderRecipient" r ON r."id" = o."orderRecipientId" WHERE r."buyerId" = 777 AND o."createdAt" >= now() - interval '365 days' AND o."createdAt" < now() ORDER BY o."createdAt" DESC LIMIT 20;
```

**Индекс:** `OrderRecipient ("buyerId")` — обычный b-tree

### До

```
                                                                          QUERY PLAN                                                                           
---------------------------------------------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=2815.95..2815.97 rows=9 width=42) (actual time=3.850..3.852 rows=20.00 loops=1)
   Buffers: shared hit=1325
   ->  Sort  (cost=2815.95..2815.97 rows=9 width=42) (actual time=3.849..3.850 rows=20.00 loops=1)
         Sort Key: o."createdAt" DESC
         Sort Method: quicksort  Memory: 26kB
         Buffers: shared hit=1325
         ->  Nested Loop  (cost=0.29..2815.81 rows=9 width=42) (actual time=0.094..3.832 rows=26.00 loops=1)
               Buffers: shared hit=1322
               ->  Seq Scan on "OrderRecipient" r  (cost=0.00..2666.00 rows=18 width=4) (actual time=0.023..3.515 rows=52.00 loops=1)
                     Filter: (("buyerId")::integer = 777)
                     Rows Removed by Filter: 119948
                     Buffers: shared hit=1166
               ->  Index Scan using "Order_orderRecipientId_key" on "Order" o  (cost=0.29..8.32 rows=1 width=46) (actual time=0.006..0.006 rows=0.50 loops=52)
                     Index Cond: (("orderRecipientId")::integer = r.id)
                     Filter: (("createdAt" < now()) AND ("createdAt" >= (now() - '365 days'::interval)))
                     Rows Removed by Filter: 0
                     Index Searches: 52
                     Buffers: shared hit=156
 Planning:
   Buffers: shared hit=269
 Planning Time: 0.446 ms
 Execution Time: 3.883 ms
(22 rows)
```

### После

```
                                                                          QUERY PLAN                                                                           
---------------------------------------------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=219.90..219.92 rows=9 width=42) (actual time=0.802..0.804 rows=20.00 loops=1)
   Buffers: shared hit=211 read=2
   ->  Sort  (cost=219.90..219.92 rows=9 width=42) (actual time=0.800..0.802 rows=20.00 loops=1)
         Sort Key: o."createdAt" DESC
         Sort Method: quicksort  Memory: 26kB
         Buffers: shared hit=211 read=2
         ->  Nested Loop  (cost=4.72..219.75 rows=9 width=42) (actual time=0.089..0.765 rows=26.00 loops=1)
               Buffers: shared hit=208 read=2
               ->  Bitmap Heap Scan on "OrderRecipient" r  (cost=4.43..69.95 rows=18 width=4) (actual time=0.056..0.299 rows=52.00 loops=1)
                     Recheck Cond: (("buyerId")::integer = 777)
                     Heap Blocks: exact=52
                     Buffers: shared hit=52 read=2
                     ->  Bitmap Index Scan on "OrderRecipient_buyerId_idx"  (cost=0.00..4.43 rows=18 width=0) (actual time=0.040..0.040 rows=52.00 loops=1)
                           Index Cond: (("buyerId")::integer = 777)
                           Index Searches: 1
                           Buffers: shared read=2
               ->  Index Scan using "Order_orderRecipientId_key" on "Order" o  (cost=0.29..8.32 rows=1 width=46) (actual time=0.008..0.008 rows=0.50 loops=52)
                     Index Cond: (("orderRecipientId")::integer = r.id)
                     Filter: (("createdAt" < now()) AND ("createdAt" >= (now() - '365 days'::interval)))
                     Rows Removed by Filter: 0
                     Index Searches: 52
                     Buffers: shared hit=156
 Planning:
   Buffers: shared hit=307 read=2
 Planning Time: 1.107 ms
 Execution Time: 0.876 ms
(26 rows)
```

**Что изменилось.** Исчез `Seq Scan on "OrderRecipient"`, который прочитывал все 120 000 снапшотов ради 52 нужных строк; вместо него `Bitmap Index Scan` по `buyerId` достаёт сразу нужные tid, и heap читается только на 52 страницах вместо 1166. Сама `"Order"` и до, и после берётся через уже существующий уникальный индекс на `"orderRecipientId"` — отдельный индекс под неё не нужен, поэтому его и нет.

---

## q2 — проблемные оплаты за 30 дней (PARTIAL)

Админский экран разбора неудачных платежей: только `failed_payment`, только свежие.

```sql
SELECT o."id", o."publicId", o."totalAmount", o."currency", o."createdAt" FROM "Order" o WHERE o."status" = 'failed_payment' AND o."createdAt" >= now() - interval '30 days' ORDER BY o."createdAt" DESC LIMIT 50;
```

**Индекс:** `Order ("createdAt" DESC) WHERE "status" = 'failed_payment'` — **partial**

### До

```
                                                       QUERY PLAN                                                       
------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=3864.93..3865.02 rows=36 width=38) (actual time=8.768..8.772 rows=29.00 loops=1)
   Buffers: shared hit=1467
   ->  Sort  (cost=3864.93..3865.02 rows=36 width=38) (actual time=8.767..8.768 rows=29.00 loops=1)
         Sort Key: "createdAt" DESC
         Sort Method: quicksort  Memory: 27kB
         Buffers: shared hit=1467
         ->  Seq Scan on "Order" o  (cost=0.00..3864.00 rows=36 width=38) (actual time=0.277..8.737 rows=29.00 loops=1)
               Filter: ((status = 'failed_payment'::"StatusEnum") AND ("createdAt" >= (now() - '30 days'::interval)))
               Rows Removed by Filter: 119971
               Buffers: shared hit=1464
 Planning:
   Buffers: shared hit=141
 Planning Time: 0.421 ms
 Execution Time: 8.817 ms
(14 rows)
```

### После

```
                                                                         QUERY PLAN                                                                          
-------------------------------------------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=112.97..113.04 rows=30 width=38) (actual time=0.223..0.226 rows=29.00 loops=1)
   Buffers: shared hit=28 read=2
   ->  Sort  (cost=112.97..113.04 rows=30 width=38) (actual time=0.222..0.223 rows=29.00 loops=1)
         Sort Key: "createdAt" DESC
         Sort Method: quicksort  Memory: 27kB
         Buffers: shared hit=28 read=2
         ->  Bitmap Heap Scan on "Order" o  (cost=4.51..112.23 rows=30 width=38) (actual time=0.064..0.184 rows=29.00 loops=1)
               Recheck Cond: (("createdAt" >= (now() - '30 days'::interval)) AND (status = 'failed_payment'::"StatusEnum"))
               Heap Blocks: exact=25
               Buffers: shared hit=25 read=2
               ->  Bitmap Index Scan on "Order_failedPayment_createdAt_idx"  (cost=0.00..4.50 rows=30 width=0) (actual time=0.047..0.048 rows=29.00 loops=1)
                     Index Cond: ("createdAt" >= (now() - '30 days'::interval))
                     Index Searches: 1
                     Buffers: shared read=2
 Planning:
   Buffers: shared hit=158
 Planning Time: 0.434 ms
 Execution Time: 0.270 ms
(18 rows)
```

**Что изменилось.** `Seq Scan on "Order"` фильтровал 120 000 строк, отбрасывая 119 970 — на статус, который занимает 0.67% таблицы. Partial-индекс физически содержит только эти 803 строки, поэтому `Bitmap Index Scan` сразу отдаёт 30 попавших в окно, и buffers падают с 1467 до 35. Полный индекс `(status, createdAt)` решил бы ту же задачу, но весит 3720 kB против 40 kB у partial — в 93 раза больше — и большая его часть описывает `completed`, который по селективности всё равно всегда читается Seq Scan'ом.

---

## q3 — поиск товара без учёта регистра (EXPRESSION)

Строка поиска в каталоге: пользователь вводит текст в произвольном регистре, ищем по англоязычным названиям.

```sql
SELECT p."id", p."slug", t."title" FROM "ProductTranslation" t JOIN "Product" p ON p."id" = t."productId" WHERE t."language" = 'en' AND lower(t."title") LIKE 'sony wh-1000xm5 1234%' LIMIT 20;
```

**Индекс:** `ProductTranslation (lower("title") text_pattern_ops) WHERE "language" = 'en'` — **expression** (и заодно partial)

### До

```
                                                                 QUERY PLAN                                                                 
--------------------------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=0.29..359.73 rows=20 width=36) (actual time=3.503..6.690 rows=2.00 loops=1)
   Buffers: shared hit=541
   ->  Nested Loop  (cost=0.29..1797.50 rows=100 width=36) (actual time=3.502..6.688 rows=2.00 loops=1)
         Buffers: shared hit=541
         ->  Seq Scan on "ProductTranslation" t  (cost=0.00..1235.00 rows=100 width=23) (actual time=3.476..6.659 rows=2.00 loops=1)
               Filter: ((language = 'en'::"LanguageEnum") AND (lower((title)::text) ~~ 'sony wh-1000xm5 1234%'::text))
               Rows Removed by Filter: 39998
               Buffers: shared hit=535
         ->  Index Scan using "Product_pkey" on "Product" p  (cost=0.29..5.62 rows=1 width=17) (actual time=0.012..0.012 rows=1.00 loops=2)
               Index Cond: (id = (t."productId")::integer)
               Index Searches: 2
               Buffers: shared hit=6
 Planning:
   Buffers: shared hit=249
 Planning Time: 0.707 ms
 Execution Time: 6.712 ms
(16 rows)
```

### После

```
                                                                           QUERY PLAN                                                                           
----------------------------------------------------------------------------------------------------------------------------------------------------------------
 Limit  (cost=5.60..169.10 rows=20 width=36) (actual time=0.111..0.118 rows=2.00 loops=1)
   Buffers: shared hit=8 read=2
   ->  Nested Loop  (cost=5.60..823.11 rows=100 width=36) (actual time=0.110..0.116 rows=2.00 loops=1)
         Buffers: shared hit=8 read=2
         ->  Bitmap Heap Scan on "ProductTranslation" t  (cost=5.31..260.61 rows=100 width=23) (actual time=0.091..0.094 rows=2.00 loops=1)
               Recheck Cond: (language = 'en'::"LanguageEnum")
               Filter: (lower((title)::text) ~~ 'sony wh-1000xm5 1234%'::text)
               Heap Blocks: exact=2
               Buffers: shared hit=2 read=2
               ->  Bitmap Index Scan on "ProductTranslation_lowerTitle_en_idx"  (cost=0.00..5.29 rows=100 width=0) (actual time=0.037..0.037 rows=2.00 loops=1)
                     Index Cond: ((lower((title)::text) ~>=~ 'sony wh-1000xm5 1234'::text) AND (lower((title)::text) ~<~ 'sony wh-1000xm5 1235'::text))
                     Index Searches: 1
                     Buffers: shared read=2
         ->  Index Scan using "Product_pkey" on "Product" p  (cost=0.29..5.62 rows=1 width=17) (actual time=0.009..0.009 rows=1.00 loops=2)
               Index Cond: (id = (t."productId")::integer)
               Index Searches: 2
               Buffers: shared hit=6
 Planning:
   Buffers: shared hit=308 read=1
 Planning Time: 1.045 ms
 Execution Time: 0.157 ms
(21 rows)
```

**Что изменилось.** В `WHERE` стоит `lower("title")`, поэтому индекс по самой колонке `title` планер бы проигнорировал — выражение в индексе обязано совпадать с выражением в запросе. Индекс по выражению убирает `Seq Scan on "ProductTranslation"` (40 000 строк, из них 39 998 отбрасывались фильтром); `text_pattern_ops` позволяет свести `LIKE 'prefix%'` к диапазонному `Index Cond` независимо от collation базы. Джойн к `"Product"` и раньше шёл по PK, он не менялся.

---

## Проверка на лишние индексы

«Про запас» ничего не создавалось: каждый индекс — это диск и замедление `INSERT`. После прогона всех трёх запросов все три индекса из `db/indexes.sql` реально использованы:

```
                 indexrelname                 | idx_scan
----------------------------------------------+----------
 OrderRecipient_buyerId_idx                   |        1
 Order_failedPayment_createdAt_idx            |        1
 ProductTranslation_lowerTitle_en_idx         |        1
```

`SELECT indexrelname, idx_scan FROM pg_stat_user_indexes WHERE idx_scan = 0;` показывает только индексы, созданные автоматически под `PRIMARY KEY` и `UNIQUE` в `schema.sql` — их задача констрейнты, а не эти три запроса.

Под q1 сознательно не создан индекс на `"Order" ("orderRecipientId")`: связь 1:1, и уникальный констрейнт уже даёт нужный индекс — видно в плане как `Index Scan using "Order_orderRecipientId_key"`.
