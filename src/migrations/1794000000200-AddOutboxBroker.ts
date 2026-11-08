import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOutboxBroker1794000000200 implements MigrationInterface {
    name = 'AddOutboxBroker1794000000200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "IdentityOutbox" ADD "broker" character varying(16) NOT NULL DEFAULT 'kafka'`);
        await queryRunner.query(`ALTER TABLE "UserOutbox" ADD "broker" character varying(16) NOT NULL DEFAULT 'kafka'`);
        await queryRunner.query(`ALTER TABLE "OrderOutbox" ADD "broker" character varying(16) NOT NULL DEFAULT 'kafka'`);
        await queryRunner.query(`ALTER TABLE "ProductOutbox" ADD "broker" character varying(16) NOT NULL DEFAULT 'kafka'`);
        await queryRunner.query(`ALTER TABLE "MediaOutbox" ADD "broker" character varying(16) NOT NULL DEFAULT 'kafka'`);
        await queryRunner.query(`UPDATE "MediaOutbox" SET "broker" = 'rabbitmq'`);
        await queryRunner.query(`ALTER TABLE "IdentityOutbox" ALTER COLUMN "broker" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "IdentityOutbox" ADD CONSTRAINT "IdentityOutbox_broker_known" CHECK ("broker" IN ('kafka', 'rabbitmq'))`);
        await queryRunner.query(`ALTER TABLE "UserOutbox" ALTER COLUMN "broker" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "UserOutbox" ADD CONSTRAINT "UserOutbox_broker_known" CHECK ("broker" IN ('kafka', 'rabbitmq'))`);
        await queryRunner.query(`ALTER TABLE "OrderOutbox" ALTER COLUMN "broker" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "OrderOutbox" ADD CONSTRAINT "OrderOutbox_broker_known" CHECK ("broker" IN ('kafka', 'rabbitmq'))`);
        await queryRunner.query(`ALTER TABLE "ProductOutbox" ALTER COLUMN "broker" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "ProductOutbox" ADD CONSTRAINT "ProductOutbox_broker_known" CHECK ("broker" IN ('kafka', 'rabbitmq'))`);
        await queryRunner.query(`ALTER TABLE "MediaOutbox" ALTER COLUMN "broker" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "MediaOutbox" ADD CONSTRAINT "MediaOutbox_broker_known" CHECK ("broker" IN ('kafka', 'rabbitmq'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "MediaOutbox" DROP CONSTRAINT "MediaOutbox_broker_known"`);
        await queryRunner.query(`ALTER TABLE "MediaOutbox" DROP COLUMN "broker"`);
        await queryRunner.query(`ALTER TABLE "ProductOutbox" DROP CONSTRAINT "ProductOutbox_broker_known"`);
        await queryRunner.query(`ALTER TABLE "ProductOutbox" DROP COLUMN "broker"`);
        await queryRunner.query(`ALTER TABLE "OrderOutbox" DROP CONSTRAINT "OrderOutbox_broker_known"`);
        await queryRunner.query(`ALTER TABLE "OrderOutbox" DROP COLUMN "broker"`);
        await queryRunner.query(`ALTER TABLE "UserOutbox" DROP CONSTRAINT "UserOutbox_broker_known"`);
        await queryRunner.query(`ALTER TABLE "UserOutbox" DROP COLUMN "broker"`);
        await queryRunner.query(`ALTER TABLE "IdentityOutbox" DROP CONSTRAINT "IdentityOutbox_broker_known"`);
        await queryRunner.query(`ALTER TABLE "IdentityOutbox" DROP COLUMN "broker"`);
    }

}
