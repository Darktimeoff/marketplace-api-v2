import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccountBalance1790949258576 implements MigrationInterface {
    name = 'AddAccountBalance1790949258576'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "Account" ("customerId" integer NOT NULL, "balance" numeric(12,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "Account_pkey" PRIMARY KEY ("customerId"))`);
        await queryRunner.query(`CREATE TRIGGER "Account_setUpdatedAt" BEFORE UPDATE ON "Account" FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"()`);
        await queryRunner.query(`INSERT INTO "Account" ("customerId", "balance") SELECT "userId", COALESCE(SUM(CASE WHEN "type"::text IN ('DEPOSIT', 'REFUND') THEN "amount" ELSE -"amount" END) FILTER (WHERE "status" = 'SUCCESS'), 0) FROM "Transaction" WHERE "deletedAt" IS NULL GROUP BY "userId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER "Account_setUpdatedAt" ON "Account"`);
        await queryRunner.query(`DROP TABLE "Account"`);
    }

}
