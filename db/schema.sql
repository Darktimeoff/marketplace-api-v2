-- Marketplace schema (PostgreSQL) — таблицы, типы и констрейнты.
-- Индексов оптимизации здесь НЕТ намеренно: они в db/indexes.sql.
-- На этой схеме все три запроса из db/queries/ дают Seq Scan.
-- Идентификаторы в camelCase => везде двойные кавычки.

-- Схема идемпотентна: файл можно применять сколько угодно раз подряд, в том числе
-- на базе, где он уже накатился при старте контейнера. Без этого повторный
-- `psql -f db/schema.sql` падал бы на «type ... already exists».
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

CREATE EXTENSION IF NOT EXISTS citext;

-- ---------- domains ----------
-- Postgres не поддерживает UNSIGNED; ближайший аналог — домен с CHECK.
-- Применяется к FK и quantity. НЕ к PK: identity-колонка не может иметь доменный тип
-- и без того стартует с 1.
CREATE DOMAIN "uint"   AS integer      CHECK (VALUE > 0);
CREATE DOMAIN "amount" AS numeric(12,2) CHECK (VALUE >= 0);

-- ---------- enums ----------
CREATE TYPE "LanguageEnum"    AS ENUM ('en', 'ua');
CREATE TYPE "RoleEnum"        AS ENUM ('owner', 'seller', 'admin', 'user');
CREATE TYPE "GenderEnum"      AS ENUM ('male', 'female');
CREATE TYPE "CountryCodeEnum" AS ENUM ('UA', 'US', 'PL', 'DE', 'GB');
CREATE TYPE "CurrencyEnum"    AS ENUM ('UAH', 'EUR', 'USD');
CREATE TYPE "StatusEnum"      AS ENUM (
  'created', 'pending_payment', 'failed_payment', 'paid', 'confirmed',
  'preparing', 'shipped', 'delivered', 'completed', 'canceled', 'refunded'
);

-- ---------- updatedAt trigger ----------
CREATE FUNCTION "setUpdatedAt"() RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------- Phone ----------
CREATE TABLE "Phone" (
  "id"             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "countryCode"    "CountryCodeEnum" NOT NULL,
  "rawNumber"      varchar(32)  NOT NULL,
  "fullNumber"     varchar(16)  NOT NULL,
  "nationalNumber" varchar(15)  NOT NULL,
  "createdAt"      timestamptz  NOT NULL DEFAULT now(),
  "updatedAt"      timestamptz  NOT NULL DEFAULT now(),
  "deletedAt"      timestamptz,
  CONSTRAINT "Phone_fullNumber_e164"     CHECK ("fullNumber" ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT "Phone_nationalNumber_fmt"  CHECK ("nationalNumber" ~ '^[0-9]{4,15}$'),
  CONSTRAINT "Phone_deletedAt_order"     CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt")
);
-- "fullNumber" НЕ unique: OrderRecipient делает снапшот-копию номера на каждый заказ.

-- ---------- DeliveryAddress ----------
CREATE TABLE "DeliveryAddress" (
  "id"          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "addressLine" varchar(255) NOT NULL,
  "city"        varchar(100) NOT NULL,
  "building"    varchar(32),
  "createdAt"   timestamptz  NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz  NOT NULL DEFAULT now(),
  "deletedAt"   timestamptz,
  CONSTRAINT "DeliveryAddress_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt")
);

-- ---------- Identity ----------
CREATE TABLE "Identity" (
  "id"           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "email"        citext UNIQUE,
  "phoneId"      "uint" UNIQUE REFERENCES "Phone"("id") ON DELETE RESTRICT,
  "passwordHash" varchar(255) NOT NULL,
  "role"         "RoleEnum"   NOT NULL DEFAULT 'user',
  "activatedAt"  timestamptz,
  "createdAt"    timestamptz  NOT NULL DEFAULT now(),
  "updatedAt"    timestamptz  NOT NULL DEFAULT now(),
  "deletedAt"    timestamptz,
  CONSTRAINT "Identity_login_present"   CHECK ("email" IS NOT NULL OR "phoneId" IS NOT NULL),
  CONSTRAINT "Identity_email_format"    CHECK ("email" IS NULL OR "email" ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT "Identity_activatedAt_ord" CHECK ("activatedAt" IS NULL OR "activatedAt" >= "createdAt"),
  CONSTRAINT "Identity_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt")
);

-- ---------- User ----------
CREATE TABLE "User" (
  "id"                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "identityId"        "uint" NOT NULL UNIQUE REFERENCES "Identity"("id") ON DELETE RESTRICT,
  "firstName"         varchar(100),
  "lastName"          varchar(100),
  "fullName"          varchar(201) GENERATED ALWAYS AS (
                        nullif(trim(coalesce("firstName", '') || ' ' || coalesce("lastName", '')), '')
                      ) STORED,
  "dateOfBirth"       date,
  "gender"            "GenderEnum",
  "language"          "LanguageEnum" NOT NULL DEFAULT 'en',
  "timezone"          varchar(64)    NOT NULL DEFAULT 'Europe/London',
  "deliveryAddressId" "uint" UNIQUE REFERENCES "DeliveryAddress"("id") ON DELETE RESTRICT,
  "createdAt"         timestamptz NOT NULL DEFAULT now(),
  "updatedAt"         timestamptz NOT NULL DEFAULT now(),
  "deletedAt"         timestamptz,
  CONSTRAINT "User_dateOfBirth_past" CHECK ("dateOfBirth" IS NULL OR "dateOfBirth" < current_date),
  CONSTRAINT "User_deletedAt_order"  CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt")
);

-- ---------- Brand ----------
CREATE TABLE "Brand" (
  "id"        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "slug"      varchar(120) NOT NULL UNIQUE,
  "createdAt" timestamptz  NOT NULL DEFAULT now(),
  "updatedAt" timestamptz  NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "Brand_slug_format"     CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT "Brand_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt")
);

CREATE TABLE "BrandTranslation" (
  "id"        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "brandId"   "uint" NOT NULL REFERENCES "Brand"("id") ON DELETE CASCADE,
  "name"      varchar(255)   NOT NULL,
  "language"  "LanguageEnum" NOT NULL,
  "createdAt" timestamptz    NOT NULL DEFAULT now(),
  "updatedAt" timestamptz    NOT NULL DEFAULT now(),
  "deletedAt" timestamptz,
  CONSTRAINT "BrandTranslation_brandId_language" UNIQUE ("brandId", "language"),
  CONSTRAINT "BrandTranslation_name_notBlank"    CHECK (btrim("name") <> '')
);

-- ---------- Category ----------
CREATE TABLE "Category" (
  "id"               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "slug"             varchar(120) NOT NULL UNIQUE,
  "parentCategoryId" "uint" REFERENCES "Category"("id") ON DELETE RESTRICT,
  "createdAt"        timestamptz NOT NULL DEFAULT now(),
  "updatedAt"        timestamptz NOT NULL DEFAULT now(),
  "deletedAt"        timestamptz,
  CONSTRAINT "Category_slug_format"     CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT "Category_no_self_parent"  CHECK ("parentCategoryId" IS DISTINCT FROM "id"),
  CONSTRAINT "Category_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt")
);

CREATE TABLE "CategoryTranslation" (
  "id"         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "categoryId" "uint" NOT NULL REFERENCES "Category"("id") ON DELETE CASCADE,
  "name"       varchar(255)   NOT NULL,
  "language"   "LanguageEnum" NOT NULL,
  "createdAt"  timestamptz    NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz    NOT NULL DEFAULT now(),
  "deletedAt"  timestamptz,
  CONSTRAINT "CategoryTranslation_categoryId_language" UNIQUE ("categoryId", "language"),
  CONSTRAINT "CategoryTranslation_name_notBlank"       CHECK (btrim("name") <> '')
);

-- ---------- Product ----------
CREATE TABLE "Product" (
  "id"         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "categoryId" "uint" NOT NULL REFERENCES "Category"("id") ON DELETE RESTRICT,
  "brandId"    "uint" NOT NULL REFERENCES "Brand"("id")    ON DELETE RESTRICT,
  "slug"       varchar(120) NOT NULL UNIQUE,
  "createdAt"  timestamptz  NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz  NOT NULL DEFAULT now(),
  "deletedAt"  timestamptz,
  CONSTRAINT "Product_slug_format"     CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT "Product_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt")
);

CREATE TABLE "ProductTranslation" (
  "id"          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "productId"   "uint" NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "title"       varchar(255)   NOT NULL,
  "description" text,
  "language"    "LanguageEnum" NOT NULL,
  "createdAt"   timestamptz    NOT NULL DEFAULT now(),
  "updatedAt"   timestamptz    NOT NULL DEFAULT now(),
  "deletedAt"   timestamptz,
  CONSTRAINT "ProductTranslation_productId_language" UNIQUE ("productId", "language"),
  CONSTRAINT "ProductTranslation_title_notBlank"     CHECK (btrim("title") <> '')
);

-- ---------- ProductOffer ----------
CREATE TABLE "ProductOffer" (
  "id"            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "productId"     "uint" NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT,
  "sellerId"      "uint" NOT NULL REFERENCES "User"("id")    ON DELETE RESTRICT,
  "sku"           varchar(64)    NOT NULL,
  "price"         "amount"       NOT NULL,
  "currency"      "CurrencyEnum" NOT NULL,
  "discountPrice" "amount",
  "createdAt"     timestamptz    NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz    NOT NULL DEFAULT now(),
  "deletedAt"     timestamptz,
  CONSTRAINT "ProductOffer_sellerId_sku"   UNIQUE ("sellerId", "sku"),
  CONSTRAINT "ProductOffer_sku_notBlank"   CHECK (btrim("sku") <> ''),
  CONSTRAINT "ProductOffer_discount_le"    CHECK ("discountPrice" IS NULL OR "discountPrice" <= "price"),
  CONSTRAINT "ProductOffer_deletedAt_ord"  CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt")
);

-- ---------- OrderRecipient ----------
CREATE TABLE "OrderRecipient" (
  "id"                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "buyerId"           "uint" NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "fullName"          varchar(201) NOT NULL,
  "phoneId"           "uint" NOT NULL UNIQUE REFERENCES "Phone"("id")           ON DELETE RESTRICT,
  "deliveryAddressId" "uint" NOT NULL UNIQUE REFERENCES "DeliveryAddress"("id") ON DELETE RESTRICT,
  "createdAt"         timestamptz NOT NULL DEFAULT now(),
  "updatedAt"         timestamptz NOT NULL DEFAULT now(),
  "deletedAt"         timestamptz,
  CONSTRAINT "OrderRecipient_fullName_notBlank" CHECK (btrim("fullName") <> ''),
  CONSTRAINT "OrderRecipient_deletedAt_order"   CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt")
);

-- ---------- Order ----------
CREATE TABLE "Order" (
  "id"               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "publicId"         uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  "orderRecipientId" "uint" NOT NULL UNIQUE REFERENCES "OrderRecipient"("id") ON DELETE RESTRICT,
  "status"           "StatusEnum"   NOT NULL DEFAULT 'created',
  "totalAmount"      "amount"       NOT NULL,
  "discountAmount"   "amount"       NOT NULL DEFAULT 0,
  "currency"         "CurrencyEnum" NOT NULL,
  "createdAt"        timestamptz    NOT NULL DEFAULT now(),
  "updatedAt"        timestamptz    NOT NULL DEFAULT now(),
  "deletedAt"        timestamptz,
  CONSTRAINT "Order_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt")
);

-- ---------- OrderProduct ----------
CREATE TABLE "OrderProduct" (
  "orderId"        "uint" NOT NULL REFERENCES "Order"("id")        ON DELETE CASCADE,
  "productOfferId" "uint" NOT NULL REFERENCES "ProductOffer"("id") ON DELETE RESTRICT,
  "quantity"       "uint"   NOT NULL,
  "price"          "amount" NOT NULL,
  "discountPrice"  "amount",
  "createdAt"      timestamptz NOT NULL DEFAULT now(),
  "updatedAt"      timestamptz NOT NULL DEFAULT now(),
  "deletedAt"      timestamptz,
  PRIMARY KEY ("orderId", "productOfferId"),
  CONSTRAINT "OrderProduct_discount_le"   CHECK ("discountPrice" IS NULL OR "discountPrice" <= "price"),
  CONSTRAINT "OrderProduct_deletedAt_ord" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt")
);

-- ---------- updatedAt triggers ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Phone', 'DeliveryAddress', 'Identity', 'User', 'Brand', 'BrandTranslation',
    'Category', 'CategoryTranslation', 'Product', 'ProductTranslation',
    'ProductOffer', 'OrderRecipient', 'Order', 'OrderProduct'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"()',
      t || '_setUpdatedAt', t
    );
  END LOOP;
END $$;
