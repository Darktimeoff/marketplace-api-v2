import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderWorkflowOutbox1791000000120 implements MigrationInterface {
    name = 'AddOrderWorkflowOutbox1791000000120'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "OrderWorkflowOutbox" ("workflowId" character varying(255) NOT NULL, "workflowType" character varying(128) NOT NULL, "taskQueue" character varying(128) NOT NULL, "input" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "startedAt" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT 0, "lastError" text, CONSTRAINT "OrderWorkflowOutbox_attempts_nonneg" CHECK ("attempts" >= 0), CONSTRAINT "OrderWorkflowOutbox_startedAt_order" CHECK ("startedAt" IS NULL OR "startedAt" >= "createdAt"), CONSTRAINT "OrderWorkflowOutbox_pkey" PRIMARY KEY ("workflowId"))`);
        await queryRunner.query(`CREATE INDEX "OrderWorkflowOutbox_unstarted_idx" ON "OrderWorkflowOutbox" ("createdAt") WHERE "startedAt" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "OrderWorkflowOutbox"`);
    }

}
