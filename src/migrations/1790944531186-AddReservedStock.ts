import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReservedStock1790944531186 implements MigrationInterface {
    name = 'AddReservedStock1790944531186'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."StockReservationStatusEnum" AS ENUM('reserved', 'confirmed', 'fulfilled', 'released')`);
        await queryRunner.query(`ALTER TABLE "StockReservation" ADD "status" "public"."StockReservationStatusEnum" NOT NULL DEFAULT 'reserved'`);
        await queryRunner.query(`UPDATE "StockReservation" SET "status" = 'confirmed'`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD "reservedQuantity" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`UPDATE "SellerOffer" AS offer SET "quantity" = offer."quantity" + held."total", "reservedQuantity" = held."total" FROM (SELECT "offerId", SUM("quantity")::int AS "total" FROM "StockReservation" WHERE "status" IN ('reserved', 'confirmed') GROUP BY "offerId") AS held WHERE offer."id" = held."offerId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_reserved_range" CHECK ("reservedQuantity" >= 0 AND "reservedQuantity" <= "quantity")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP CONSTRAINT "SellerOffer_reserved_range"`);
        await queryRunner.query(`UPDATE "SellerOffer" SET "quantity" = "quantity" - "reservedQuantity" WHERE "reservedQuantity" > 0`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP COLUMN "reservedQuantity"`);
        await queryRunner.query(`ALTER TABLE "StockReservation" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."StockReservationStatusEnum"`);
    }

}
