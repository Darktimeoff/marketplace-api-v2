-- Минимальный набор индексов, лечащий все три запроса из db/queries/.
-- Ничего «про запас»: каждый индекс — это диск и замедление INSERT.

-- q1: заказы покупателя за период.
-- Узкое место — поиск снапшотов получателя по buyerId (Seq Scan по 120k строк).
-- Дальше "Order" достаётся по уже существующему уникальному индексу
-- на "orderRecipientId", отдельный индекс не нужен.
CREATE INDEX "OrderRecipient_buyerId_idx"
  ON "OrderRecipient" ("buyerId");

-- q2: PARTIAL. Проблемные оплаты — 0.7% таблицы, и админка смотрит только на них.
-- Полный индекс по (status, createdAt) был бы в ~140 раз больше и покрывал бы
-- 'completed', который всё равно всегда читается Seq Scan'ом из-за селективности.
CREATE INDEX "Order_failedPayment_createdAt_idx"
  ON "Order" ("createdAt" DESC)
  WHERE "status" = 'failed_payment';

-- q3: EXPRESSION. В WHERE стоит lower("title"), поэтому индекс по самой колонке
-- планер бы проигнорировал — выражение в индексе обязано совпадать с выражением
-- в запросе. text_pattern_ops нужен, чтобы LIKE 'prefix%' мог использовать
-- индекс независимо от collation базы.
CREATE INDEX "ProductTranslation_lowerTitle_en_idx"
  ON "ProductTranslation" (lower("title") text_pattern_ops)
  WHERE "language" = 'en';
