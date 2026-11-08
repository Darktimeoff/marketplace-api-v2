import { MigrationInterface, QueryRunner } from "typeorm";

export class OrderLineOfferPublicId1793000000500 implements MigrationInterface {
    name = 'OrderLineOfferPublicId1793000000500'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "OrderLine" ADD "offerPublicId" uuid`);
        await queryRunner.query(`UPDATE "OrderLine" SET "offerPublicId" = "SellerOffer"."publicId" FROM "SellerOffer" WHERE "SellerOffer"."id" = "OrderLine"."offerId"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" ALTER COLUMN "offerPublicId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderLine" DROP CONSTRAINT "OrderLine_pkey"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" DROP COLUMN "offerId"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("orderId", "offerPublicId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "OrderLine" ADD "offerId" integer`);
        await queryRunner.query(`UPDATE "OrderLine" SET "offerId" = "SellerOffer"."id" FROM "SellerOffer" WHERE "SellerOffer"."publicId" = "OrderLine"."offerPublicId"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" ALTER COLUMN "offerId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderLine" DROP CONSTRAINT "OrderLine_pkey"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" DROP COLUMN "offerPublicId"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("orderId", "offerId")`);
    }

}
