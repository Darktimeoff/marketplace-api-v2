import { MigrationInterface, QueryRunner } from "typeorm"

export class SplitProductVariantSellerOffer1789862400000 implements MigrationInterface {
    name = 'SplitProductVariantSellerOffer1789862400000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "Seller" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "userId" "uint" NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "Seller_userId_key" UNIQUE ("userId"), CONSTRAINT "Seller_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "Seller_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "Seller" ADD CONSTRAINT "Seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TRIGGER "Seller_setUpdatedAt" BEFORE UPDATE ON "Seller" FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"()`);
        await queryRunner.query(`INSERT INTO "Seller" ("userId") SELECT DISTINCT "sellerId" FROM "ProductOffer"`);

        await queryRunner.query(`CREATE TABLE "ProductVariant" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "productId" "uint" NOT NULL, "sku" character varying(64) NOT NULL, "barcode" character varying(14), "slug" character varying(120) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "ProductVariant_sku_key" UNIQUE ("sku"), CONSTRAINT "ProductVariant_barcode_key" UNIQUE ("barcode"), CONSTRAINT "ProductVariant_slug_key" UNIQUE ("slug"), CONSTRAINT "ProductVariant_sku_notBlank" CHECK (btrim("sku") <> ''), CONSTRAINT "ProductVariant_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), CONSTRAINT "ProductVariant_barcode_format" CHECK ("barcode" IS NULL OR "barcode" ~ '^[0-9]{8,14}$'), CONSTRAINT "ProductVariant_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE INDEX "ProductVariant_productId_idx" ON "ProductVariant" ("productId")`);
        await queryRunner.query(`CREATE TRIGGER "ProductVariant_setUpdatedAt" BEFORE UPDATE ON "ProductVariant" FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"()`);
        await queryRunner.query(`INSERT INTO "ProductVariant" ("productId", "sku", "slug") SELECT o."productId", 'sku-' || o."id", p."slug" || '-v' || o."id" FROM "ProductOffer" o JOIN "Product" p ON p."id" = o."productId" ORDER BY o."id"`);

        await queryRunner.query(`ALTER TABLE "ProductOffer" RENAME TO "SellerOffer"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME COLUMN "sku" TO "sellerSku"`);
        await queryRunner.query(`ALTER TRIGGER "ProductOffer_setUpdatedAt" ON "SellerOffer" RENAME TO "SellerOffer_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "ProductOffer_pkey" TO "SellerOffer_pkey"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "ProductOffer_sellerId_sku" TO "SellerOffer_sellerId_sellerSku"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "ProductOffer_sku_notBlank" TO "SellerOffer_sellerSku_notBlank"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "ProductOffer_discount_le" TO "SellerOffer_discount_le"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "ProductOffer_quantity_nonneg" TO "SellerOffer_quantity_nonneg"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "ProductOffer_deletedAt_ord" TO "SellerOffer_deletedAt_ord"`);

        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD COLUMN "variantId" "uint"`);
        await queryRunner.query(`UPDATE "SellerOffer" o SET "variantId" = v."id" FROM "ProductVariant" v WHERE v."sku" = 'sku-' || o."id"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ALTER COLUMN "variantId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP CONSTRAINT "ProductOffer_sellerId_fkey"`);
        await queryRunner.query(`UPDATE "SellerOffer" o SET "sellerId" = s."id" FROM "Seller" s WHERE s."userId" = o."sellerId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_sellerId_variantId" UNIQUE ("sellerId", "variantId")`);

        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP CONSTRAINT "ProductOffer_productId_fkey"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP COLUMN "productId"`);

        await queryRunner.query(`ALTER TABLE "OrderProduct" DROP CONSTRAINT "OrderProduct_productOfferId_fkey"`);
        await queryRunner.query(`ALTER TABLE "OrderProduct" RENAME COLUMN "productOfferId" TO "offerId"`);
        await queryRunner.query(`ALTER TABLE "OrderProduct" ADD CONSTRAINT "OrderProduct_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SellerOffer"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        await queryRunner.query(`ALTER TABLE "Product" DROP CONSTRAINT "Product_slug_format"`);
        await queryRunner.query(`ALTER TABLE "Product" DROP CONSTRAINT "Product_slug_key"`);
        await queryRunner.query(`ALTER TABLE "Product" DROP COLUMN "slug"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Product" ADD COLUMN "slug" character varying(120)`);
        await queryRunner.query(`UPDATE "Product" p SET "slug" = sub."slug" FROM (SELECT "productId", regexp_replace(min("slug"), '-v[0-9]+$', '') AS "slug" FROM "ProductVariant" GROUP BY "productId") sub WHERE sub."productId" = p."id"`);
        await queryRunner.query(`UPDATE "Product" SET "slug" = 'product-' || "id" WHERE "slug" IS NULL`);
        await queryRunner.query(`ALTER TABLE "Product" ALTER COLUMN "slug" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "Product" ADD CONSTRAINT "Product_slug_key" UNIQUE ("slug")`);
        await queryRunner.query(`ALTER TABLE "Product" ADD CONSTRAINT "Product_slug_format" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')`);

        await queryRunner.query(`ALTER TABLE "OrderProduct" DROP CONSTRAINT "OrderProduct_offerId_fkey"`);
        await queryRunner.query(`ALTER TABLE "OrderProduct" RENAME COLUMN "offerId" TO "productOfferId"`);

        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD COLUMN "productId" "uint"`);
        await queryRunner.query(`UPDATE "SellerOffer" o SET "productId" = v."productId" FROM "ProductVariant" v WHERE v."id" = o."variantId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ALTER COLUMN "productId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP CONSTRAINT "SellerOffer_sellerId_variantId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP CONSTRAINT "SellerOffer_variantId_fkey"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP COLUMN "variantId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP CONSTRAINT "SellerOffer_sellerId_fkey"`);
        await queryRunner.query(`UPDATE "SellerOffer" o SET "sellerId" = s."userId" FROM "Seller" s WHERE s."id" = o."sellerId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "SellerOffer_deletedAt_ord" TO "ProductOffer_deletedAt_ord"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "SellerOffer_quantity_nonneg" TO "ProductOffer_quantity_nonneg"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "SellerOffer_discount_le" TO "ProductOffer_discount_le"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "SellerOffer_sellerSku_notBlank" TO "ProductOffer_sku_notBlank"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "SellerOffer_sellerId_sellerSku" TO "ProductOffer_sellerId_sku"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "SellerOffer_pkey" TO "ProductOffer_pkey"`);
        await queryRunner.query(`ALTER TRIGGER "SellerOffer_setUpdatedAt" ON "SellerOffer" RENAME TO "ProductOffer_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME COLUMN "sellerSku" TO "sku"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME TO "ProductOffer"`);
        await queryRunner.query(`ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "OrderProduct" ADD CONSTRAINT "OrderProduct_productOfferId_fkey" FOREIGN KEY ("productOfferId") REFERENCES "ProductOffer"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        await queryRunner.query(`DROP TABLE "ProductVariant"`);
        await queryRunner.query(`DROP TABLE "Seller"`);
    }
}
