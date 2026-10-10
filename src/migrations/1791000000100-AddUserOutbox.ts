import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserOutbox1791000000100 implements MigrationInterface {
    name = 'AddUserOutbox1791000000100'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "UserOutbox" ("id" uuid NOT NULL, "topic" character varying(249) NOT NULL, "aggregateType" character varying(64) NOT NULL, "aggregateId" character varying(64) NOT NULL, "type" character varying(128) NOT NULL, "payload" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "publishedAt" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT 0, "lastError" text, CONSTRAINT "UserOutbox_attempts_nonneg" CHECK ("attempts" >= 0), CONSTRAINT "UserOutbox_publishedAt_order" CHECK ("publishedAt" IS NULL OR "publishedAt" >= "createdAt"), CONSTRAINT "UserOutbox_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "UserOutbox_unpublished_idx" ON "UserOutbox" ("createdAt") WHERE "publishedAt" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "UserOutbox"`);
    }

}
