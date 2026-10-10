import { MigrationInterface, QueryRunner } from "typeorm";

export class DropOrderOutboxBroker1791000000130 implements MigrationInterface {
    name = 'DropOrderOutboxBroker1791000000130'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "OrderOutbox" DROP CONSTRAINT "OrderOutbox_broker_known"`);
        await queryRunner.query(`ALTER TABLE "OrderOutbox" DROP COLUMN "broker"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "OrderOutbox" ADD "broker" character varying(16) NOT NULL DEFAULT 'kafka'`);
        await queryRunner.query(`ALTER TABLE "OrderOutbox" ALTER COLUMN "broker" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "OrderOutbox" ADD CONSTRAINT "OrderOutbox_broker_known" CHECK ("broker" IN ('rabbitmq', 'kafka'))`);
    }

}
