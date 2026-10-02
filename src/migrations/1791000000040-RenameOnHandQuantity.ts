import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameOnHandQuantity1791000000040 implements MigrationInterface {
    name = 'RenameOnHandQuantity1791000000040'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME COLUMN "quantity" TO "onHandQuantity"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "SellerOffer_quantity_nonneg" TO "SellerOffer_onHandQuantity_nonneg"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP CONSTRAINT "SellerOffer_variantId_fkey"`);
        await queryRunner.query(`ALTER TABLE "Seller" DROP CONSTRAINT "Seller_userId_fkey"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Seller" ADD CONSTRAINT "Seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME CONSTRAINT "SellerOffer_onHandQuantity_nonneg" TO "SellerOffer_quantity_nonneg"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" RENAME COLUMN "onHandQuantity" TO "quantity"`);
    }

}
