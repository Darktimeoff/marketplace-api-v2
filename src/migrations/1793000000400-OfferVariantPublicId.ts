import { MigrationInterface, QueryRunner } from "typeorm";

export class OfferVariantPublicId1793000000400 implements MigrationInterface {
    name = 'OfferVariantPublicId1793000000400'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD "variantPublicId" uuid`);
        await queryRunner.query(`UPDATE "SellerOffer" SET "variantPublicId" = "ProductVariant"."publicId" FROM "ProductVariant" WHERE "ProductVariant"."id" = "SellerOffer"."variantId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ALTER COLUMN "variantPublicId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP CONSTRAINT "SellerOffer_sellerId_variantId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP COLUMN "variantId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_sellerId_variantPublicId" UNIQUE ("sellerId", "variantPublicId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD "variantId" integer`);
        await queryRunner.query(`UPDATE "SellerOffer" SET "variantId" = "ProductVariant"."id" FROM "ProductVariant" WHERE "ProductVariant"."publicId" = "SellerOffer"."variantPublicId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ALTER COLUMN "variantId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP CONSTRAINT "SellerOffer_sellerId_variantPublicId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP COLUMN "variantPublicId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_sellerId_variantId" UNIQUE ("sellerId", "variantId")`);
    }

}
