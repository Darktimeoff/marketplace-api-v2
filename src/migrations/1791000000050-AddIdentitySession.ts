import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIdentitySession1791000000050 implements MigrationInterface {
    name = 'AddIdentitySession1791000000050'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Identity" ADD CONSTRAINT "Identity_loginPhoneFullNumber_key" UNIQUE ("loginPhoneFullNumber")`);
        await queryRunner.query(`CREATE TABLE "IdentitySession" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "identityId" "uint" NOT NULL, "familyId" uuid NOT NULL, "tokenHash" character(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "usedAt" TIMESTAMP WITH TIME ZONE, "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "IdentitySession_tokenHash_key" UNIQUE ("tokenHash"), CONSTRAINT "IdentitySession_expiresAt_order" CHECK ("expiresAt" > "createdAt"), CONSTRAINT "IdentitySession_usedAt_order" CHECK ("usedAt" IS NULL OR "usedAt" >= "createdAt"), CONSTRAINT "IdentitySession_revokedAt_order" CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt"), CONSTRAINT "IdentitySession_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IdentitySession_identityId_idx" ON "IdentitySession" ("identityId")`);
        await queryRunner.query(`CREATE INDEX "IdentitySession_familyId_idx" ON "IdentitySession" ("familyId")`);
        await queryRunner.query(`ALTER TABLE "IdentitySession" ADD CONSTRAINT "IdentitySession_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TRIGGER "IdentitySession_setUpdatedAt" BEFORE UPDATE ON "IdentitySession" FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "IdentitySession"`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP CONSTRAINT "Identity_loginPhoneFullNumber_key"`);
    }

}
