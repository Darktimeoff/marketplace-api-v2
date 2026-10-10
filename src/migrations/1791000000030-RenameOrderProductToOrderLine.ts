import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameOrderProductToOrderLine1791000000030 implements MigrationInterface {
    name = 'RenameOrderProductToOrderLine1791000000030'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "OrderProduct" DROP CONSTRAINT "OrderProduct_offerId_fkey"`);
        await queryRunner.query(`ALTER TABLE "OrderProduct" RENAME TO "OrderLine"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME CONSTRAINT "OrderProduct_pkey" TO "OrderLine_pkey"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME CONSTRAINT "OrderProduct_discount_le" TO "OrderLine_discount_le"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME CONSTRAINT "OrderProduct_deletedAt_ord" TO "OrderLine_deletedAt_ord"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME CONSTRAINT "OrderProduct_orderId_fkey" TO "OrderLine_orderId_fkey"`);
        await queryRunner.query(`ALTER TRIGGER "OrderProduct_setUpdatedAt" ON "OrderLine" RENAME TO "OrderLine_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME COLUMN "price" TO "unitPrice"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME COLUMN "discountPrice" TO "unitDiscountPrice"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME COLUMN "unitDiscountPrice" TO "discountPrice"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME COLUMN "unitPrice" TO "price"`);
        await queryRunner.query(`ALTER TRIGGER "OrderLine_setUpdatedAt" ON "OrderLine" RENAME TO "OrderProduct_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME CONSTRAINT "OrderLine_orderId_fkey" TO "OrderProduct_orderId_fkey"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME CONSTRAINT "OrderLine_deletedAt_ord" TO "OrderProduct_deletedAt_ord"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME CONSTRAINT "OrderLine_discount_le" TO "OrderProduct_discount_le"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME CONSTRAINT "OrderLine_pkey" TO "OrderProduct_pkey"`);
        await queryRunner.query(`ALTER TABLE "OrderLine" RENAME TO "OrderProduct"`);
        await queryRunner.query(`ALTER TABLE "OrderProduct" ADD CONSTRAINT "OrderProduct_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "SellerOffer"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
