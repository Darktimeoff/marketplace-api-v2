import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStockReservation1790931836340 implements MigrationInterface {
    name = 'AddStockReservation1790931836340'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "StockReservation" ("orderPublicId" uuid NOT NULL, "offerId" integer NOT NULL, "quantity" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "StockReservation_quantity_positive" CHECK ("quantity" > 0), CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("orderPublicId", "offerId"))`);
        await queryRunner.query(`ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SellerOffer"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TRIGGER "StockReservation_setUpdatedAt" BEFORE UPDATE ON "StockReservation" FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER "StockReservation_setUpdatedAt" ON "StockReservation"`);
        await queryRunner.query(`ALTER TABLE "StockReservation" DROP CONSTRAINT "StockReservation_offerId_fkey"`);
        await queryRunner.query(`DROP TABLE "StockReservation"`);
    }

}
