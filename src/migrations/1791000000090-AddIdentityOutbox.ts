import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIdentityOutbox1791000000090 implements MigrationInterface {
    name = 'AddIdentityOutbox1791000000090'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "IdentityOutbox" ("id" uuid NOT NULL, "topic" character varying(249) NOT NULL, "aggregateType" character varying(64) NOT NULL, "aggregateId" character varying(64) NOT NULL, "type" character varying(128) NOT NULL, "payload" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "publishedAt" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT 0, "lastError" text, CONSTRAINT "IdentityOutbox_attempts_nonneg" CHECK ("attempts" >= 0), CONSTRAINT "IdentityOutbox_publishedAt_order" CHECK ("publishedAt" IS NULL OR "publishedAt" >= "createdAt"), CONSTRAINT "IdentityOutbox_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IdentityOutbox_unpublished_idx" ON "IdentityOutbox" ("createdAt") WHERE "publishedAt" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "IdentityOutbox"`);
    }

}
