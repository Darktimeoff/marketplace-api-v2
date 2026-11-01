import { MigrationInterface, QueryRunner } from "typeorm";

export class OrderBuyerIdentifiers1793000000200 implements MigrationInterface {
    name = 'OrderBuyerIdentifiers1793000000200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`INSERT INTO "OrderBuyer" ("identityPublicId", "userId") SELECT DISTINCT "User"."publicId", "User"."id" FROM "Order" JOIN "User" ON "User"."id" = "Order"."userId" LEFT JOIN "OrderBuyer" ON "OrderBuyer"."userId" = "Order"."userId" WHERE "OrderBuyer"."userId" IS NULL AND "Order"."ownerIdentityPublicId" IS NULL ON CONFLICT DO NOTHING`);
        await queryRunner.query(`INSERT INTO "OrderBuyer" ("identityPublicId", "userId") SELECT gen_random_uuid(), "orphans"."userId" FROM (SELECT DISTINCT "Order"."userId" FROM "Order" LEFT JOIN "OrderBuyer" ON "OrderBuyer"."userId" = "Order"."userId" WHERE "OrderBuyer"."userId" IS NULL AND "Order"."ownerIdentityPublicId" IS NULL) AS "orphans"`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" ADD "id" integer GENERATED ALWAYS AS IDENTITY`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" RENAME COLUMN "identityPublicId" TO "publicId"`);
        await queryRunner.query(`ALTER TABLE "Order" ADD "buyerId" integer`);
        await queryRunner.query(`UPDATE "Order" SET "buyerId" = "OrderBuyer"."id" FROM "OrderBuyer" WHERE "OrderBuyer"."publicId" = "Order"."ownerIdentityPublicId"`);
        await queryRunner.query(`UPDATE "Order" SET "buyerId" = "OrderBuyer"."id" FROM "OrderBuyer" WHERE "Order"."buyerId" IS NULL AND "OrderBuyer"."userId" = "Order"."userId"`);
        await queryRunner.query(`ALTER TABLE "Order" ALTER COLUMN "buyerId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" DROP CONSTRAINT "OrderBuyer_pkey"`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" ADD CONSTRAINT "OrderBuyer_pkey" PRIMARY KEY ("id")`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" ADD CONSTRAINT "OrderBuyer_publicId_key" UNIQUE ("publicId")`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" DROP CONSTRAINT "OrderBuyer_userId_key"`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_idempotencyKey_key"`);
        await queryRunner.query(`DROP INDEX "public"."Order_ownerIdentityPublicId_idx"`);
        await queryRunner.query(`ALTER TABLE "Order" DROP COLUMN "ownerIdentityPublicId"`);
        await queryRunner.query(`ALTER TABLE "Order" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_idempotencyKey_key" UNIQUE ("buyerId", "idempotencyKey")`);
        await queryRunner.query(`ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "OrderBuyer"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Order" DROP CONSTRAINT "Order_buyerId_fkey"`);
        await queryRunner.query(`ALTER TABLE "Order" DROP CONSTRAINT "Order_buyerId_idempotencyKey_key"`);
        await queryRunner.query(`ALTER TABLE "Order" ADD "userId" integer`);
        await queryRunner.query(`ALTER TABLE "Order" ADD "ownerIdentityPublicId" uuid`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" ADD "userId" integer`);
        await queryRunner.query(`UPDATE "OrderBuyer" SET "userId" = "User"."id" FROM "User" WHERE "User"."publicId" = "OrderBuyer"."publicId"`);
        await queryRunner.query(`UPDATE "Order" SET "userId" = COALESCE("OrderBuyer"."userId", 0), "ownerIdentityPublicId" = "OrderBuyer"."publicId" FROM "OrderBuyer" WHERE "OrderBuyer"."id" = "Order"."buyerId"`);
        await queryRunner.query(`UPDATE "OrderBuyer" SET "userId" = 0 - "id" WHERE "userId" IS NULL`);
        await queryRunner.query(`ALTER TABLE "Order" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "Order" DROP COLUMN "buyerId"`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" DROP CONSTRAINT "OrderBuyer_publicId_key"`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" DROP CONSTRAINT "OrderBuyer_pkey"`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" DROP COLUMN "id"`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" RENAME COLUMN "publicId" TO "identityPublicId"`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" ADD CONSTRAINT "OrderBuyer_pkey" PRIMARY KEY ("identityPublicId")`);
        await queryRunner.query(`ALTER TABLE "OrderBuyer" ADD CONSTRAINT "OrderBuyer_userId_key" UNIQUE ("userId")`);
        await queryRunner.query(`CREATE INDEX "Order_ownerIdentityPublicId_idx" ON "Order" ("ownerIdentityPublicId")`);
        await queryRunner.query(`ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_idempotencyKey_key" UNIQUE ("userId", "idempotencyKey")`);
    }

}
