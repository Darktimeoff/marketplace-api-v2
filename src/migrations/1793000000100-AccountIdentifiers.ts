import { MigrationInterface, QueryRunner } from "typeorm";

export class AccountIdentifiers1793000000100 implements MigrationInterface {
    name = 'AccountIdentifiers1793000000100'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Account" ADD "id" integer GENERATED ALWAYS AS IDENTITY`);
        await queryRunner.query(`ALTER TABLE "Account" ADD "publicId" uuid`);
        await queryRunner.query(`UPDATE "Account" SET "publicId" = "User"."publicId" FROM "User" WHERE "User"."id" = "Account"."customerId"`);
        await queryRunner.query(`ALTER TABLE "Account" ALTER COLUMN "publicId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "Transaction" ADD "accountId" integer`);
        await queryRunner.query(`UPDATE "Transaction" SET "accountId" = "Account"."id" FROM "Account" WHERE "Account"."customerId" = "Transaction"."customerId"`);
        await queryRunner.query(`ALTER TABLE "Transaction" ALTER COLUMN "accountId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_customerId_fkey"`);
        await queryRunner.query(`DROP INDEX "public"."Transaction_customerId_idx"`);
        await queryRunner.query(`ALTER TABLE "Transaction" DROP COLUMN "customerId"`);
        await queryRunner.query(`ALTER TABLE "Account" DROP CONSTRAINT "Account_pkey"`);
        await queryRunner.query(`ALTER TABLE "Account" DROP COLUMN "customerId"`);
        await queryRunner.query(`ALTER TABLE "Account" ADD CONSTRAINT "Account_pkey" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "Account" ADD CONSTRAINT "Account_publicId_key" UNIQUE ("publicId")`);
        await queryRunner.query(`ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE INDEX "Transaction_accountId_idx" ON "Transaction" ("accountId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Account" ADD "customerId" integer`);
        await queryRunner.query(`UPDATE "Account" SET "customerId" = "User"."id" FROM "User" WHERE "User"."publicId" = "Account"."publicId"`);
        await queryRunner.query(`ALTER TABLE "Account" ALTER COLUMN "customerId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "Transaction" ADD "customerId" integer`);
        await queryRunner.query(`UPDATE "Transaction" SET "customerId" = "Account"."customerId" FROM "Account" WHERE "Account"."id" = "Transaction"."accountId"`);
        await queryRunner.query(`ALTER TABLE "Transaction" ALTER COLUMN "customerId" SET NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."Transaction_accountId_idx"`);
        await queryRunner.query(`ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_accountId_fkey"`);
        await queryRunner.query(`ALTER TABLE "Transaction" DROP COLUMN "accountId"`);
        await queryRunner.query(`ALTER TABLE "Account" DROP CONSTRAINT "Account_publicId_key"`);
        await queryRunner.query(`ALTER TABLE "Account" DROP CONSTRAINT "Account_pkey"`);
        await queryRunner.query(`ALTER TABLE "Account" DROP COLUMN "publicId"`);
        await queryRunner.query(`ALTER TABLE "Account" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "Account" ADD CONSTRAINT "Account_pkey" PRIMARY KEY ("customerId")`);
        await queryRunner.query(`ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Account"("customerId") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE INDEX "Transaction_customerId_idx" ON "Transaction" ("customerId")`);
    }

}
