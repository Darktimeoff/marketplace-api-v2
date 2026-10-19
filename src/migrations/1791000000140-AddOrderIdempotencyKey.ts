import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderIdempotencyKey1791000000140 implements MigrationInterface {
    name = 'AddOrderIdempotencyKey1791000000140'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Order" ADD "idempotencyKey" uuid`);
        await queryRunner.query(`ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_idempotencyKey_key" UNIQUE ("userId", "idempotencyKey")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_idempotencyKey_key"`);
        await queryRunner.query(`ALTER TABLE "Order" DROP COLUMN "idempotencyKey"`);
    }

}
