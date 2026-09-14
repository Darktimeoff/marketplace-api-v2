import { MigrationInterface, QueryRunner } from "typeorm"

export class AddJobQueueProcessing1789405980915 implements MigrationInterface {
    name = 'AddJobQueueProcessing1789405980915'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "BackgroundJob" ADD COLUMN "processedCount" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_processedCount_nonneg" CHECK ("processedCount" >= 0)`);
        await queryRunner.query(`ALTER TABLE "BackgroundJob" ADD COLUMN "processedBy" character varying(64)`);
        await queryRunner.query(`CREATE INDEX "BackgroundJob_queue_idx" ON "BackgroundJob" ("type", "createdAt") WHERE "status" = 'QUEUED'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."BackgroundJob_queue_idx"`);
        await queryRunner.query(`ALTER TABLE "BackgroundJob" DROP COLUMN "processedBy"`);
        await queryRunner.query(`ALTER TABLE "BackgroundJob" DROP CONSTRAINT "BackgroundJob_processedCount_nonneg"`);
        await queryRunner.query(`ALTER TABLE "BackgroundJob" DROP COLUMN "processedCount"`);
    }
}
