import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAccountInbox1790948332938 implements MigrationInterface {
    name = 'AddAccountInbox1790948332938'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "AccountInbox" ("consumer" character varying(100) NOT NULL, "messageId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "AccountInbox_pkey" PRIMARY KEY ("consumer", "messageId"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "AccountInbox"`);
    }

}
