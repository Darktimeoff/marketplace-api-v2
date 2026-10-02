import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefundTransactionType1790948285224 implements MigrationInterface {
    name = 'AddRefundTransactionType1790948285224'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."TransactionTypeEnum" ADD VALUE 'REFUND'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."TransactionTypeEnum" RENAME TO "TransactionTypeEnum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."TransactionTypeEnum" AS ENUM('DEPOSIT', 'PAYMENT', 'WITHDRAWAL')`);
        await queryRunner.query(`ALTER TABLE "Transaction" ALTER COLUMN "type" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "Transaction" ALTER COLUMN "type" TYPE "public"."TransactionTypeEnum" USING "type"::text::"public"."TransactionTypeEnum"`);
        await queryRunner.query(`ALTER TABLE "Transaction" ALTER COLUMN "type" SET DEFAULT 'PAYMENT'`);
        await queryRunner.query(`DROP TYPE "public"."TransactionTypeEnum_old"`);
    }

}
