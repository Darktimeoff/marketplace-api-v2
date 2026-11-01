import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMediaOutbox1794000000100 implements MigrationInterface {
    name = 'AddMediaOutbox1794000000100'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "MediaOutbox" ("id" uuid NOT NULL, "topic" character varying(249) NOT NULL, "aggregateType" character varying(64) NOT NULL, "aggregateId" character varying(64) NOT NULL, "type" character varying(128) NOT NULL, "payload" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "publishedAt" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT 0, "lastError" text, CONSTRAINT "MediaOutbox_attempts_nonneg" CHECK ("attempts" >= 0), CONSTRAINT "MediaOutbox_publishedAt_order" CHECK ("publishedAt" IS NULL OR "publishedAt" >= "createdAt"), CONSTRAINT "MediaOutbox_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "MediaOutbox_unpublished_idx" ON "MediaOutbox" ("createdAt") WHERE "publishedAt" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."MediaOutbox_unpublished_idx"`);
        await queryRunner.query(`DROP TABLE "MediaOutbox"`);
    }

}
