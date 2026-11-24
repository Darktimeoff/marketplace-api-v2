import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOutboxTraceparent1795000000000 implements MigrationInterface {
    name = 'AddOutboxTraceparent1795000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "IdentityOutbox" ADD "traceparent" character varying(55)`);
        await queryRunner.query(`ALTER TABLE "UserOutbox" ADD "traceparent" character varying(55)`);
        await queryRunner.query(`ALTER TABLE "OrderOutbox" ADD "traceparent" character varying(55)`);
        await queryRunner.query(`ALTER TABLE "ProductOutbox" ADD "traceparent" character varying(55)`);
        await queryRunner.query(`ALTER TABLE "MediaOutbox" ADD "traceparent" character varying(55)`);
        await queryRunner.query(`ALTER TABLE "OrderWorkflowOutbox" ADD "traceparent" character varying(55)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "OrderWorkflowOutbox" DROP COLUMN "traceparent"`);
        await queryRunner.query(`ALTER TABLE "MediaOutbox" DROP COLUMN "traceparent"`);
        await queryRunner.query(`ALTER TABLE "ProductOutbox" DROP COLUMN "traceparent"`);
        await queryRunner.query(`ALTER TABLE "OrderOutbox" DROP COLUMN "traceparent"`);
        await queryRunner.query(`ALTER TABLE "UserOutbox" DROP COLUMN "traceparent"`);
        await queryRunner.query(`ALTER TABLE "IdentityOutbox" DROP COLUMN "traceparent"`);
    }
}
