import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailInbox1790865132059 implements MigrationInterface {
    name = 'AddEmailInbox1790865132059'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "EmailInbox" ("messageId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_7fb82f4ad6f26db8dc040c629de" PRIMARY KEY ("messageId"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "EmailInbox"`);
    }

}
