import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIdentityExternalAccount1791000000200 implements MigrationInterface {
    name = 'AddIdentityExternalAccount1791000000200'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Identity" ALTER COLUMN "passwordHash" DROP NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."IdentityProviderEnum" AS ENUM('google')`);
        await queryRunner.query(`CREATE TABLE "IdentityExternalAccount" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "identityId" integer NOT NULL, "provider" "public"."IdentityProviderEnum" NOT NULL, "subject" character varying(255) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "IdentityExternalAccount_provider_subject_key" UNIQUE ("provider", "subject"), CONSTRAINT "IdentityExternalAccount_identityId_provider_key" UNIQUE ("identityId", "provider"), CONSTRAINT "IdentityExternalAccount_subject_not_blank" CHECK (btrim("subject") <> ''), CONSTRAINT "IdentityExternalAccount_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "IdentityExternalAccount" ADD CONSTRAINT "IdentityExternalAccount_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "IdentityExternalAccount"`);
        await queryRunner.query(`DROP TYPE "public"."IdentityProviderEnum"`);
        await queryRunner.query(`ALTER TABLE "Identity" ALTER COLUMN "passwordHash" SET NOT NULL`);
    }

}
