import { MigrationInterface, QueryRunner } from "typeorm";

export class UnifyUserIdentity1793000000000 implements MigrationInterface {
    name = 'UnifyUserIdentity1793000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`UPDATE "UserOutbox" SET "id" = "User"."identityPublicId", "aggregateId" = "User"."identityPublicId"::text FROM "User" WHERE "UserOutbox"."id" = "User"."publicId"`);
        await queryRunner.query(`UPDATE "User" SET "publicId" = "identityPublicId"`);
        await queryRunner.query(`ALTER TABLE "User" ALTER COLUMN "publicId" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "User" DROP CONSTRAINT "User_identityPublicId_key"`);
        await queryRunner.query(`ALTER TABLE "User" DROP CONSTRAINT "User_identityId_key"`);
        await queryRunner.query(`ALTER TABLE "User" DROP COLUMN "identityPublicId"`);
        await queryRunner.query(`ALTER TABLE "User" DROP COLUMN "identityId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "User" ADD "identityId" integer`);
        await queryRunner.query(`ALTER TABLE "User" ADD "identityPublicId" uuid`);
        await queryRunner.query(`UPDATE "User" SET "identityPublicId" = "User"."publicId", "identityId" = "Identity"."id" FROM "Identity" WHERE "Identity"."publicId" = "User"."publicId"`);
        await queryRunner.query(`ALTER TABLE "User" ALTER COLUMN "identityId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "User" ALTER COLUMN "identityPublicId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "User" ADD CONSTRAINT "User_identityId_key" UNIQUE ("identityId")`);
        await queryRunner.query(`ALTER TABLE "User" ADD CONSTRAINT "User_identityPublicId_key" UNIQUE ("identityPublicId")`);
        await queryRunner.query(`ALTER TABLE "User" ALTER COLUMN "publicId" SET DEFAULT gen_random_uuid()`);
    }

}
