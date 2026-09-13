import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Начальная схема. Получена через `typeorm migration:generate` и правлена руками —
 * генератор сравнивает только то, что умеет описать метадата TypeORM, поэтому сам он:
 *
 *  1. четырежды выдавал `CREATE TYPE "LanguageEnum"` и дважды "CurrencyEnum"
 *     (по разу на каждую использующую таблицу) — второй такой вызов падает с 42710;
 *  2. не создавал расширение citext, хотя "Identity"."email" объявлен как citext;
 *  3. разворачивал домены "uint" и "amount" в базовые integer и numeric(12,2),
 *     теряя CHECK-и (VALUE > 0) и (VALUE >= 0) — то есть замену UNSIGNED из ДЗ #12;
 *  4. не знает про триггеры "…_setUpdatedAt" и функцию "setUpdatedAt";
 *  5. давал констрейнтам свои хешевые имена (PK_faeb810…) вместо тех, что стоят
 *     в db/schema.sql (Phone_pkey, Identity_email_key, …).
 *
 * Всё перечисленное восстановлено вручную, поэтому схема после этой миграции
 * совпадает с db/schema.sql из ДЗ #12 (проверено pg_dump --schema-only).
 */
export class InitSchema1788889879820 implements MigrationInterface {
    name = 'InitSchema1788889879820'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // citext: регистронезависимый unique по email без .toLowerCase() в коде.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);

        // В Postgres нет UNSIGNED; ближайший аналог — домен с CHECK.
        await queryRunner.query(`CREATE DOMAIN "uint" AS integer CHECK (VALUE > 0)`);
        await queryRunner.query(`CREATE DOMAIN "amount" AS numeric(12,2) CHECK (VALUE >= 0)`);

        // Каждый enum создаётся один раз, а не по разу на использующую таблицу.
        await queryRunner.query(`CREATE TYPE "public"."LanguageEnum" AS ENUM('en', 'ua')`);
        await queryRunner.query(`CREATE TYPE "public"."RoleEnum" AS ENUM('owner', 'seller', 'admin', 'user')`);
        await queryRunner.query(`CREATE TYPE "public"."GenderEnum" AS ENUM('male', 'female')`);
        await queryRunner.query(`CREATE TYPE "public"."CountryCodeEnum" AS ENUM('UA', 'US', 'PL', 'DE', 'GB')`);
        await queryRunner.query(`CREATE TYPE "public"."CurrencyEnum" AS ENUM('UAH', 'EUR', 'USD')`);
        await queryRunner.query(`CREATE TYPE "public"."StatusEnum" AS ENUM('created', 'pending_payment', 'failed_payment', 'paid', 'confirmed', 'preparing', 'shipped', 'delivered', 'completed', 'canceled', 'refunded')`);

        await queryRunner.query(`CREATE FUNCTION "setUpdatedAt"() RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`);

        await queryRunner.query(`CREATE TABLE "Phone" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "countryCode" "public"."CountryCodeEnum" NOT NULL, "rawNumber" character varying(32) NOT NULL, "fullNumber" character varying(16) NOT NULL, "nationalNumber" character varying(15) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "Phone_fullNumber_e164" CHECK ("fullNumber" ~ '^\\+[1-9][0-9]{7,14}$'), CONSTRAINT "Phone_nationalNumber_fmt" CHECK ("nationalNumber" ~ '^[0-9]{4,15}$'), CONSTRAINT "Phone_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "Phone_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "DeliveryAddress" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "addressLine" character varying(255) NOT NULL, "city" character varying(100) NOT NULL, "building" character varying(32), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "DeliveryAddress_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "DeliveryAddress_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "Identity" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "email" citext, "phoneId" "uint", "passwordHash" character varying(255) NOT NULL, "role" "public"."RoleEnum" NOT NULL DEFAULT 'user', "activatedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "Identity_email_key" UNIQUE ("email"), CONSTRAINT "Identity_phoneId_key" UNIQUE ("phoneId"), CONSTRAINT "Identity_login_present" CHECK ("email" IS NOT NULL OR "phoneId" IS NOT NULL), CONSTRAINT "Identity_email_format" CHECK ("email" IS NULL OR "email" ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$'), CONSTRAINT "Identity_activatedAt_ord" CHECK ("activatedAt" IS NULL OR "activatedAt" >= "createdAt"), CONSTRAINT "Identity_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "Identity_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, $2, $3, $4, $5)`, ["public","User","GENERATED_COLUMN","fullName","nullif(trim(coalesce(\"firstName\", '') || ' ' || coalesce(\"lastName\", '')), '')"]);
        await queryRunner.query(`CREATE TABLE "User" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "identityId" "uint" NOT NULL, "firstName" character varying(100), "lastName" character varying(100), "fullName" character varying(201) GENERATED ALWAYS AS (nullif(trim(coalesce("firstName", '') || ' ' || coalesce("lastName", '')), '')) STORED, "dateOfBirth" date, "gender" "public"."GenderEnum", "language" "public"."LanguageEnum" NOT NULL DEFAULT 'en', "timezone" character varying(64) NOT NULL DEFAULT 'Europe/London', "deliveryAddressId" "uint", "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "User_identityId_key" UNIQUE ("identityId"), CONSTRAINT "User_deliveryAddressId_key" UNIQUE ("deliveryAddressId"), CONSTRAINT "User_dateOfBirth_past" CHECK ("dateOfBirth" IS NULL OR "dateOfBirth" < current_date), CONSTRAINT "User_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "User_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "Brand" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "slug" character varying(120) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "Brand_slug_key" UNIQUE ("slug"), CONSTRAINT "Brand_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), CONSTRAINT "Brand_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "Brand_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "BrandTranslation" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "brandId" "uint" NOT NULL, "name" character varying(255) NOT NULL, "language" "public"."LanguageEnum" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "BrandTranslation_brandId_language" UNIQUE ("brandId", "language"), CONSTRAINT "BrandTranslation_name_notBlank" CHECK (btrim("name") <> ''), CONSTRAINT "BrandTranslation_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "Category" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "slug" character varying(120) NOT NULL, "parentCategoryId" "uint", "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "Category_slug_key" UNIQUE ("slug"), CONSTRAINT "Category_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), CONSTRAINT "Category_no_self_parent" CHECK ("parentCategoryId" IS DISTINCT FROM "id"), CONSTRAINT "Category_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "Category_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "CategoryTranslation" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "categoryId" "uint" NOT NULL, "name" character varying(255) NOT NULL, "language" "public"."LanguageEnum" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CategoryTranslation_categoryId_language" UNIQUE ("categoryId", "language"), CONSTRAINT "CategoryTranslation_name_notBlank" CHECK (btrim("name") <> ''), CONSTRAINT "CategoryTranslation_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "Product" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "categoryId" "uint" NOT NULL, "brandId" "uint" NOT NULL, "slug" character varying(120) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "Product_slug_key" UNIQUE ("slug"), CONSTRAINT "Product_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), CONSTRAINT "Product_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "Product_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "ProductTranslation" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "productId" "uint" NOT NULL, "title" character varying(255) NOT NULL, "description" text, "language" "public"."LanguageEnum" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "ProductTranslation_productId_language" UNIQUE ("productId", "language"), CONSTRAINT "ProductTranslation_title_notBlank" CHECK (btrim("title") <> ''), CONSTRAINT "ProductTranslation_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "ProductOffer" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "productId" "uint" NOT NULL, "sellerId" "uint" NOT NULL, "sku" character varying(64) NOT NULL, "price" "amount" NOT NULL, "currency" "public"."CurrencyEnum" NOT NULL, "discountPrice" "amount", "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "ProductOffer_sellerId_sku" UNIQUE ("sellerId", "sku"), CONSTRAINT "ProductOffer_sku_notBlank" CHECK (btrim("sku") <> ''), CONSTRAINT "ProductOffer_discount_le" CHECK ("discountPrice" IS NULL OR "discountPrice" <= "price"), CONSTRAINT "ProductOffer_deletedAt_ord" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "ProductOffer_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "OrderRecipient" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "buyerId" "uint" NOT NULL, "fullName" character varying(201) NOT NULL, "phoneId" "uint" NOT NULL, "deliveryAddressId" "uint" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "OrderRecipient_phoneId_key" UNIQUE ("phoneId"), CONSTRAINT "OrderRecipient_deliveryAddressId_key" UNIQUE ("deliveryAddressId"), CONSTRAINT "OrderRecipient_fullName_notBlank" CHECK (btrim("fullName") <> ''), CONSTRAINT "OrderRecipient_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "OrderRecipient_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "Order" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "publicId" uuid NOT NULL DEFAULT gen_random_uuid(), "orderRecipientId" "uint" NOT NULL, "status" "public"."StatusEnum" NOT NULL DEFAULT 'created', "totalAmount" "amount" NOT NULL, "discountAmount" "amount" NOT NULL DEFAULT 0, "currency" "public"."CurrencyEnum" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "Order_publicId_key" UNIQUE ("publicId"), CONSTRAINT "Order_orderRecipientId_key" UNIQUE ("orderRecipientId"), CONSTRAINT "Order_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "Order_pkey" PRIMARY KEY ("id"))`);

        await queryRunner.query(`CREATE TABLE "OrderProduct" ("orderId" "uint" NOT NULL, "productOfferId" "uint" NOT NULL, "quantity" "uint" NOT NULL, "price" "amount" NOT NULL, "discountPrice" "amount", "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "OrderProduct_discount_le" CHECK ("discountPrice" IS NULL OR "discountPrice" <= "price"), CONSTRAINT "OrderProduct_deletedAt_ord" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "OrderProduct_pkey" PRIMARY KEY ("orderId", "productOfferId"))`);

        await queryRunner.query(`ALTER TABLE "Identity" ADD CONSTRAINT "Identity_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "Phone"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "User" ADD CONSTRAINT "User_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "User" ADD CONSTRAINT "User_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "DeliveryAddress"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "BrandTranslation" ADD CONSTRAINT "BrandTranslation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Category" ADD CONSTRAINT "Category_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "CategoryTranslation" ADD CONSTRAINT "CategoryTranslation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ProductTranslation" ADD CONSTRAINT "ProductTranslation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD CONSTRAINT "OrderRecipient_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD CONSTRAINT "OrderRecipient_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "Phone"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD CONSTRAINT "OrderRecipient_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "DeliveryAddress"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Order" ADD CONSTRAINT "Order_orderRecipientId_fkey" FOREIGN KEY ("orderRecipientId") REFERENCES "OrderRecipient"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "OrderProduct" ADD CONSTRAINT "OrderProduct_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "OrderProduct" ADD CONSTRAINT "OrderProduct_productOfferId_fkey" FOREIGN KEY ("productOfferId") REFERENCES "ProductOffer"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        // Триггеры "updatedAt": TypeORM обновляет поле сам только через свой Repository,
        // а триггер держит инвариант и для голого SQL.
        for (const table of ["Phone", "DeliveryAddress", "Identity", "User", "Brand", "BrandTranslation", "Category", "CategoryTranslation", "Product", "ProductTranslation", "ProductOffer", "OrderRecipient", "Order", "OrderProduct"]) {
            await queryRunner.query(`CREATE TRIGGER "${table}_setUpdatedAt" BEFORE UPDATE ON "${table}" FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"()`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Таблицы сносятся в обратном порядке зависимостей, вместе с ними уходят
        // их FK и триггеры. Дальше — то, что живёт вне таблиц.
        for (const table of ["OrderProduct", "Order", "OrderRecipient", "ProductOffer", "ProductTranslation", "Product", "CategoryTranslation", "Category", "BrandTranslation", "Brand", "User", "Identity", "DeliveryAddress", "Phone"]) {
            await queryRunner.query(`DROP TABLE "${table}"`);
        }

        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3 AND "table" = $4`, ["GENERATED_COLUMN","fullName","public","User"]);

        await queryRunner.query(`DROP FUNCTION "setUpdatedAt"()`);

        await queryRunner.query(`DROP TYPE "public"."StatusEnum"`);
        await queryRunner.query(`DROP TYPE "public"."CurrencyEnum"`);
        await queryRunner.query(`DROP TYPE "public"."CountryCodeEnum"`);
        await queryRunner.query(`DROP TYPE "public"."GenderEnum"`);
        await queryRunner.query(`DROP TYPE "public"."RoleEnum"`);
        await queryRunner.query(`DROP TYPE "public"."LanguageEnum"`);

        await queryRunner.query(`DROP DOMAIN "amount"`);
        await queryRunner.query(`DROP DOMAIN "uint"`);

        // citext намеренно остаётся: расширение — общее свойство базы, его мог поставить
        // не только этот проект. В up() оно создаётся через IF NOT EXISTS, поэтому
        // повторный прогон миграции всё равно проходит.
    }
}
