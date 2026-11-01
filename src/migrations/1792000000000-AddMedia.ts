import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMedia1792000000000 implements MigrationInterface {
    name = 'AddMedia1792000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."MediaKindEnum" AS ENUM('image', 'video')`);
        await queryRunner.query(`CREATE TYPE "public"."MediaStatusEnum" AS ENUM('pending', 'ready', 'failed')`);
        await queryRunner.query(`CREATE TABLE "Media" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "publicId" uuid NOT NULL DEFAULT gen_random_uuid(), "ownerIdentityPublicId" uuid NOT NULL, "kind" "public"."MediaKindEnum" NOT NULL, "status" "public"."MediaStatusEnum" NOT NULL DEFAULT 'pending', "storageKey" character varying(512) NOT NULL, "mimeType" character varying(127) NOT NULL, "sizeBytes" bigint NOT NULL, "width" integer, "height" integer, "durationMs" integer, "uploadId" character varying(1024), "idempotencyKey" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "Media_publicId_key" UNIQUE ("publicId"), CONSTRAINT "Media_storageKey_key" UNIQUE ("storageKey"), CONSTRAINT "Media_ownerIdentityPublicId_idempotencyKey_key" UNIQUE ("ownerIdentityPublicId", "idempotencyKey"), CONSTRAINT "Media_sizeBytes_positive" CHECK ("sizeBytes" > 0), CONSTRAINT "Media_storageKey_not_blank" CHECK (btrim("storageKey") <> ''), CONSTRAINT "Media_pkey" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "Media"`);
        await queryRunner.query(`DROP TYPE "public"."MediaStatusEnum"`);
        await queryRunner.query(`DROP TYPE "public"."MediaKindEnum"`);
    }

}
