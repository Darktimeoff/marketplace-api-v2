import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderBuyer1791000000180 implements MigrationInterface {
    name = 'AddOrderBuyer1791000000180'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "OrderBuyer" ("identityPublicId" uuid NOT NULL, "userId" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "OrderBuyer_userId_key" UNIQUE ("userId"), CONSTRAINT "OrderBuyer_pkey" PRIMARY KEY ("identityPublicId"))`);
        await queryRunner.query(`INSERT INTO "OrderBuyer" ("identityPublicId", "userId") SELECT "identityPublicId", "id" FROM "User" ON CONFLICT DO NOTHING`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "OrderBuyer"`);
    }

}
