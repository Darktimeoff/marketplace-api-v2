import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserIdentityPublicId1791000000170 implements MigrationInterface {
    name = 'AddUserIdentityPublicId1791000000170'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "User" ADD "identityPublicId" uuid`);
        await queryRunner.query(`UPDATE "User" SET "identityPublicId" = "Identity"."publicId" FROM "Identity" WHERE "Identity"."id" = "User"."identityId"`);
        await queryRunner.query(`ALTER TABLE "User" ALTER COLUMN "identityPublicId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "User" ADD CONSTRAINT "User_identityPublicId_key" UNIQUE ("identityPublicId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "User" DROP CONSTRAINT "User_identityPublicId_key"`);
        await queryRunner.query(`ALTER TABLE "User" DROP COLUMN "identityPublicId"`);
    }

}
