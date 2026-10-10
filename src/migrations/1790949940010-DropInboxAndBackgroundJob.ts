import { MigrationInterface, QueryRunner } from "typeorm";

export class DropInboxAndBackgroundJob1790949940010 implements MigrationInterface {
    name = 'DropInboxAndBackgroundJob1790949940010'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "Inbox"`);
        await queryRunner.query(`DROP TABLE "BackgroundJob"`);
        await queryRunner.query(`DROP TYPE "public"."BackgroundJobStatusEnum"`);
        await queryRunner.query(`DROP TYPE "public"."BackgroundJobTypeEnum"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."BackgroundJobTypeEnum" AS ENUM('ORDER')`);
        await queryRunner.query(`CREATE TYPE "public"."BackgroundJobStatusEnum" AS ENUM('QUEUED', 'PROCESSING', 'READY', 'FAILED', 'INTERRUPTED')`);
        await queryRunner.query(`CREATE TABLE "BackgroundJob" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "type" "public"."BackgroundJobTypeEnum" NOT NULL, "status" "public"."BackgroundJobStatusEnum" NOT NULL DEFAULT 'QUEUED', "payload" jsonb NOT NULL, "dedupeKey" character varying(255) NOT NULL, "startedAt" TIMESTAMP WITH TIME ZONE, "finishedAt" TIMESTAMP WITH TIME ZONE, "errorMessage" text, "attempts" integer NOT NULL DEFAULT 0, "orderId" "uint", "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, "processedCount" integer NOT NULL DEFAULT 0, "processedBy" character varying(64), CONSTRAINT "BackgroundJob_dedupeKey_key" UNIQUE ("dedupeKey"), CONSTRAINT "BackgroundJob_dedupeKey_notBlank" CHECK (btrim("dedupeKey") <> ''), CONSTRAINT "BackgroundJob_attempts_nonneg" CHECK ("attempts" >= 0), CONSTRAINT "BackgroundJob_processedCount_nonneg" CHECK ("processedCount" >= 0), CONSTRAINT "BackgroundJob_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "BackgroundJob_queue_idx" ON "BackgroundJob" ("type", "createdAt") WHERE "status" = 'QUEUED'`);
        await queryRunner.query(`CREATE TRIGGER "BackgroundJob_setUpdatedAt" BEFORE UPDATE ON "BackgroundJob" FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"()`);
        await queryRunner.query(`ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TABLE "Inbox" ("consumer" character varying(100) NOT NULL, "messageId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "Inbox_pkey" PRIMARY KEY ("consumer", "messageId"))`);
    }

}
