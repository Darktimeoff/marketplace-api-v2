import { MigrationInterface, QueryRunner } from "typeorm";

export class LinkTransactionToAccount1790949513750 implements MigrationInterface {
    name = 'LinkTransactionToAccount1790949513750'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_userId_fkey"`);
        await queryRunner.query(`ALTER TABLE "Transaction" RENAME COLUMN "userId" TO "customerId"`);
        await queryRunner.query(`CREATE INDEX "Transaction_customerId_idx" ON "Transaction" ("customerId")`);
        await queryRunner.query(`ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Account"("customerId") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_customerId_fkey"`);
        await queryRunner.query(`DROP INDEX "Transaction_customerId_idx"`);
        await queryRunner.query(`ALTER TABLE "Transaction" RENAME COLUMN "customerId" TO "userId"`);
        await queryRunner.query(`ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
