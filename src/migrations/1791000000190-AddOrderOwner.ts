import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderOwner1791000000190 implements MigrationInterface {
    name = 'AddOrderOwner1791000000190'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Order" ADD "ownerIdentityPublicId" uuid`);
        await queryRunner.query(`UPDATE "Order" SET "ownerIdentityPublicId" = "OrderBuyer"."identityPublicId" FROM "OrderBuyer" WHERE "OrderBuyer"."userId" = "Order"."userId"`);
        await queryRunner.query(`CREATE INDEX "Order_ownerIdentityPublicId_idx" ON "Order" ("ownerIdentityPublicId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "Order_ownerIdentityPublicId_idx"`);
        await queryRunner.query(`ALTER TABLE "Order" DROP COLUMN "ownerIdentityPublicId"`);
    }

}
