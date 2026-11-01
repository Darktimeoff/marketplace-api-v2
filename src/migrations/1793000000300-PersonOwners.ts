import { MigrationInterface, QueryRunner } from "typeorm";

export class PersonOwners1793000000300 implements MigrationInterface {
    name = 'PersonOwners1793000000300'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Seller" ADD "ownerPublicId" uuid`);
        await queryRunner.query(`UPDATE "Seller" SET "ownerPublicId" = "User"."publicId" FROM "User" WHERE "User"."id" = "Seller"."userId"`);
        await queryRunner.query(`ALTER TABLE "Seller" ALTER COLUMN "ownerPublicId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "Seller" DROP CONSTRAINT "Seller_userId_key"`);
        await queryRunner.query(`ALTER TABLE "Seller" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "Seller" ADD CONSTRAINT "Seller_ownerPublicId_key" UNIQUE ("ownerPublicId")`);
        await queryRunner.query(`ALTER TABLE "Media" RENAME COLUMN "ownerIdentityPublicId" TO "ownerPublicId"`);
        await queryRunner.query(`ALTER TABLE "Media" RENAME CONSTRAINT "Media_ownerIdentityPublicId_idempotencyKey_key" TO "Media_ownerPublicId_idempotencyKey_key"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Media" RENAME CONSTRAINT "Media_ownerPublicId_idempotencyKey_key" TO "Media_ownerIdentityPublicId_idempotencyKey_key"`);
        await queryRunner.query(`ALTER TABLE "Media" RENAME COLUMN "ownerPublicId" TO "ownerIdentityPublicId"`);
        await queryRunner.query(`ALTER TABLE "Seller" ADD "userId" integer`);
        await queryRunner.query(`UPDATE "Seller" SET "userId" = "User"."id" FROM "User" WHERE "User"."publicId" = "Seller"."ownerPublicId"`);
        await queryRunner.query(`ALTER TABLE "Seller" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "Seller" DROP CONSTRAINT "Seller_ownerPublicId_key"`);
        await queryRunner.query(`ALTER TABLE "Seller" DROP COLUMN "ownerPublicId"`);
        await queryRunner.query(`ALTER TABLE "Seller" ADD CONSTRAINT "Seller_userId_key" UNIQUE ("userId")`);
    }

}
