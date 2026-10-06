import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameEmailInboxToInbox1790879681248 implements MigrationInterface {
    name = 'RenameEmailInboxToInbox1790879681248'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "EmailInbox" RENAME TO "Inbox"`);
        await queryRunner.query(`ALTER TABLE "Inbox" ADD "consumer" character varying(100) NOT NULL DEFAULT 'order-email'`);
        await queryRunner.query(`ALTER TABLE "Inbox" ALTER COLUMN "consumer" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "Inbox" DROP CONSTRAINT "PK_7fb82f4ad6f26db8dc040c629de"`);
        await queryRunner.query(`ALTER TABLE "Inbox" ADD CONSTRAINT "Inbox_pkey" PRIMARY KEY ("consumer", "messageId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "Inbox" WHERE "consumer" <> 'order-email'`);
        await queryRunner.query(`ALTER TABLE "Inbox" DROP CONSTRAINT "Inbox_pkey"`);
        await queryRunner.query(`ALTER TABLE "Inbox" DROP COLUMN "consumer"`);
        await queryRunner.query(`ALTER TABLE "Inbox" ADD CONSTRAINT "PK_7fb82f4ad6f26db8dc040c629de" PRIMARY KEY ("messageId")`);
        await queryRunner.query(`ALTER TABLE "Inbox" RENAME TO "EmailInbox"`);
    }

}
