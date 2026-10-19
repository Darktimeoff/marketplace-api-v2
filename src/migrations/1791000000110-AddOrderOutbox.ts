import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderOutbox1791000000110 implements MigrationInterface {
    name = 'AddOrderOutbox1791000000110'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "OrderOutbox" ("id" uuid NOT NULL, "broker" character varying(16) NOT NULL, "topic" character varying(249) NOT NULL, "aggregateType" character varying(64) NOT NULL, "aggregateId" character varying(64) NOT NULL, "type" character varying(128) NOT NULL, "payload" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "publishedAt" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT 0, "lastError" text, CONSTRAINT "OrderOutbox_broker_known" CHECK ("broker" IN ('rabbitmq', 'kafka')), CONSTRAINT "OrderOutbox_attempts_nonneg" CHECK ("attempts" >= 0), CONSTRAINT "OrderOutbox_publishedAt_order" CHECK ("publishedAt" IS NULL OR "publishedAt" >= "createdAt"), CONSTRAINT "OrderOutbox_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "OrderOutbox_unpublished_idx" ON "OrderOutbox" ("createdAt") WHERE "publishedAt" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "OrderOutbox"`);
    }

}
