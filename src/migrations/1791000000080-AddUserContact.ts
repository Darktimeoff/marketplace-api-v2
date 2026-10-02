import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserContact1791000000080 implements MigrationInterface {
    name = 'AddUserContact1791000000080'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "User" ADD "email" citext`);
        await queryRunner.query(`ALTER TABLE "User" ADD "phoneNumber" character varying(16)`);
        await queryRunner.query(`ALTER TABLE "User" DISABLE TRIGGER "User_setUpdatedAt"`);
        await queryRunner.query(`UPDATE "User" AS u SET "email" = i."email", "phoneNumber" = i."loginPhoneFullNumber" FROM "Identity" AS i WHERE i."id" = u."identityId"`);
        await queryRunner.query(`ALTER TABLE "User" ENABLE TRIGGER "User_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "User" ADD CONSTRAINT "User_email_format" CHECK ("email" IS NULL OR "email" ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')`);
        await queryRunner.query(`ALTER TABLE "User" ADD CONSTRAINT "User_phoneNumber_e164" CHECK ("phoneNumber" IS NULL OR "phoneNumber" ~ '^\\+[1-9][0-9]{7,14}$')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "User" DROP CONSTRAINT "User_phoneNumber_e164"`);
        await queryRunner.query(`ALTER TABLE "User" DROP CONSTRAINT "User_email_format"`);
        await queryRunner.query(`ALTER TABLE "User" DROP COLUMN "phoneNumber"`);
        await queryRunner.query(`ALTER TABLE "User" DROP COLUMN "email"`);
    }

}
