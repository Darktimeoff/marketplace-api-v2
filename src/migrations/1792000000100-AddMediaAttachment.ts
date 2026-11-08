import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMediaAttachment1792000000100 implements MigrationInterface {
    name = 'AddMediaAttachment1792000000100'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."MediaAttachmentTypeEnum" AS ENUM('product')`);
        await queryRunner.query(`ALTER TABLE "Media" ADD "attachedToType" "public"."MediaAttachmentTypeEnum"`);
        await queryRunner.query(`ALTER TABLE "Media" ADD "attachedToId" uuid`);
        await queryRunner.query(`ALTER TABLE "Media" ADD "attachedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "Media" ADD "claimExpiresAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "Media" ADD CONSTRAINT "Media_attachment_complete" CHECK (("attachedToType" IS NULL) = ("attachedToId" IS NULL) AND ("attachedToId" IS NULL) = ("attachedAt" IS NULL))`);
        await queryRunner.query(`ALTER TABLE "Media" ADD CONSTRAINT "Media_claim_attached" CHECK ("claimExpiresAt" IS NULL OR "attachedToId" IS NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "Media_claimExpiresAt_idx" ON "Media" ("claimExpiresAt") WHERE "claimExpiresAt" IS NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."Media_claimExpiresAt_idx"`);
        await queryRunner.query(`ALTER TABLE "Media" DROP CONSTRAINT "Media_claim_attached"`);
        await queryRunner.query(`ALTER TABLE "Media" DROP CONSTRAINT "Media_attachment_complete"`);
        await queryRunner.query(`ALTER TABLE "Media" DROP COLUMN "claimExpiresAt"`);
        await queryRunner.query(`ALTER TABLE "Media" DROP COLUMN "attachedAt"`);
        await queryRunner.query(`ALTER TABLE "Media" DROP COLUMN "attachedToId"`);
        await queryRunner.query(`ALTER TABLE "Media" DROP COLUMN "attachedToType"`);
        await queryRunner.query(`DROP TYPE "public"."MediaAttachmentTypeEnum"`);
    }

}
