import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductMediaVariant1794000000300 implements MigrationInterface {
    name = 'AddProductMediaVariant1794000000300'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ProductMedia" ADD "thumbHash" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_thumbHash_not_blank" CHECK ("thumbHash" IS NULL OR btrim("thumbHash") <> '')`);
        await queryRunner.query(`CREATE TYPE "public"."ProductMediaVariantNameEnum" AS ENUM('w320', 'w800', 'w1600', 'video-720', 'poster')`);
        await queryRunner.query(`CREATE TABLE "ProductMediaVariant" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "productMediaId" integer NOT NULL, "name" "public"."ProductMediaVariantNameEnum" NOT NULL, "mimeType" character varying(127) NOT NULL, "storageKey" character varying(512) NOT NULL, "width" integer NOT NULL, "height" integer NOT NULL, CONSTRAINT "ProductMediaVariant_productMediaId_name_key" UNIQUE ("productMediaId", "name"), CONSTRAINT "ProductMediaVariant_dimensions_positive" CHECK ("width" > 0 AND "height" > 0), CONSTRAINT "ProductMediaVariant_storageKey_not_blank" CHECK (btrim("storageKey") <> ''), CONSTRAINT "ProductMediaVariant_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "ProductMediaVariant" ADD CONSTRAINT "ProductMediaVariant_productMediaId_fkey" FOREIGN KEY ("productMediaId") REFERENCES "ProductMedia"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ProductMediaVariant" DROP CONSTRAINT "ProductMediaVariant_productMediaId_fkey"`);
        await queryRunner.query(`DROP TABLE "ProductMediaVariant"`);
        await queryRunner.query(`DROP TYPE "public"."ProductMediaVariantNameEnum"`);
        await queryRunner.query(`ALTER TABLE "ProductMedia" DROP CONSTRAINT "ProductMedia_thumbHash_not_blank"`);
        await queryRunner.query(`ALTER TABLE "ProductMedia" DROP COLUMN "thumbHash"`);
    }

}
