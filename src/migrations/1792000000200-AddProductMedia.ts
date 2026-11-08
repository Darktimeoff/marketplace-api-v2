import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductMedia1792000000200 implements MigrationInterface {
    name = 'AddProductMedia1792000000200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ProductMediaKindEnum" AS ENUM('image', 'video')`);
        await queryRunner.query(`CREATE TABLE "ProductMedia" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "productId" integer NOT NULL, "mediaPublicId" uuid NOT NULL, "position" smallint NOT NULL, "kind" "public"."ProductMediaKindEnum" NOT NULL, "mimeType" character varying(127) NOT NULL, "sizeBytes" bigint NOT NULL, "storageKey" character varying(512) NOT NULL, CONSTRAINT "ProductMedia_mediaPublicId_key" UNIQUE ("mediaPublicId"), CONSTRAINT "ProductMedia_productId_position_key" UNIQUE ("productId", "position"), CONSTRAINT "ProductMedia_position_nonneg" CHECK ("position" >= 0), CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TABLE "ProductOutbox" ("id" uuid NOT NULL, "topic" character varying(249) NOT NULL, "aggregateType" character varying(64) NOT NULL, "aggregateId" character varying(64) NOT NULL, "type" character varying(128) NOT NULL, "payload" jsonb NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "publishedAt" TIMESTAMP WITH TIME ZONE, "attempts" integer NOT NULL DEFAULT 0, "lastError" text, CONSTRAINT "ProductOutbox_attempts_nonneg" CHECK ("attempts" >= 0), CONSTRAINT "ProductOutbox_publishedAt_order" CHECK ("publishedAt" IS NULL OR "publishedAt" >= "createdAt"), CONSTRAINT "ProductOutbox_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "ProductOutbox_unpublished_idx" ON "ProductOutbox" ("createdAt") WHERE "publishedAt" IS NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."ProductOutbox_unpublished_idx"`);
        await queryRunner.query(`DROP TABLE "ProductOutbox"`);
        await queryRunner.query(`DROP TABLE "ProductMedia"`);
        await queryRunner.query(`DROP TYPE "public"."ProductMediaKindEnum"`);
    }

}
