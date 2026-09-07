SELECT p."id", p."slug", t."title" FROM "ProductTranslation" t JOIN "Product" p ON p."id" = t."productId" WHERE t."language" = 'en' AND lower(t."title") LIKE 'sony wh-1000xm5 1234%' LIMIT 20;
