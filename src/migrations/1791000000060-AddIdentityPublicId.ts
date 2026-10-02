import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIdentityPublicId1791000000060 implements MigrationInterface {
    name = 'AddIdentityPublicId1791000000060'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Identity" DISABLE TRIGGER "Identity_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "Identity" ADD "publicId" uuid NOT NULL DEFAULT gen_random_uuid()`);
        await queryRunner.query(`ALTER TABLE "Identity" ENABLE TRIGGER "Identity_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "Identity" ADD CONSTRAINT "Identity_publicId_key" UNIQUE ("publicId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Identity" DROP CONSTRAINT "Identity_publicId_key"`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP COLUMN "publicId"`);
    }

}
