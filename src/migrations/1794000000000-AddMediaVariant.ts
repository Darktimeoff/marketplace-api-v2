import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMediaVariant1794000000000 implements MigrationInterface {
    name = 'AddMediaVariant1794000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Media" ADD "thumbHash" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "Media" ADD CONSTRAINT "Media_thumbHash_not_blank" CHECK ("thumbHash" IS NULL OR btrim("thumbHash") <> '')`);
        await queryRunner.query(`CREATE TYPE "public"."MediaVariantNameEnum" AS ENUM('w320', 'w800', 'w1600', 'video-720', 'poster')`);
        await queryRunner.query(`CREATE TABLE "MediaVariant" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "mediaId" integer NOT NULL, "name" "public"."MediaVariantNameEnum" NOT NULL, "mimeType" character varying(127) NOT NULL, "storageKey" character varying(512) NOT NULL, "width" integer NOT NULL, "height" integer NOT NULL, "sizeBytes" bigint NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "MediaVariant_mediaId_name_key" UNIQUE ("mediaId", "name"), CONSTRAINT "MediaVariant_storageKey_key" UNIQUE ("storageKey"), CONSTRAINT "MediaVariant_sizeBytes_positive" CHECK ("sizeBytes" > 0), CONSTRAINT "MediaVariant_dimensions_positive" CHECK ("width" > 0 AND "height" > 0), CONSTRAINT "MediaVariant_storageKey_not_blank" CHECK (btrim("storageKey") <> ''), CONSTRAINT "MediaVariant_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "MediaVariant" ADD CONSTRAINT "MediaVariant_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "MediaVariant" DROP CONSTRAINT "MediaVariant_mediaId_fkey"`);
        await queryRunner.query(`DROP TABLE "MediaVariant"`);
        await queryRunner.query(`DROP TYPE "public"."MediaVariantNameEnum"`);
        await queryRunner.query(`ALTER TABLE "Media" DROP CONSTRAINT "Media_thumbHash_not_blank"`);
        await queryRunner.query(`ALTER TABLE "Media" DROP COLUMN "thumbHash"`);
    }

}
