import { MigrationInterface, QueryRunner } from "typeorm";

export class IdentityOwnsLoginPhone1791000000010 implements MigrationInterface {
    name = 'IdentityOwnsLoginPhone1791000000010'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Identity" ADD "loginPhoneCountryCode" "public"."CountryCodeEnum"`);
        await queryRunner.query(`ALTER TABLE "Identity" ADD "loginPhoneRawNumber" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "Identity" ADD "loginPhoneFullNumber" character varying(16)`);
        await queryRunner.query(`ALTER TABLE "Identity" ADD "loginPhoneNationalNumber" character varying(15)`);
        await queryRunner.query(`ALTER TABLE "Identity" DISABLE TRIGGER "Identity_setUpdatedAt"`);
        await queryRunner.query(`UPDATE "Identity" AS i SET "loginPhoneCountryCode" = p."countryCode", "loginPhoneRawNumber" = p."rawNumber", "loginPhoneFullNumber" = p."fullNumber", "loginPhoneNationalNumber" = p."nationalNumber" FROM "Phone" AS p WHERE p."id" = i."phoneId"`);
        await queryRunner.query(`ALTER TABLE "Identity" ENABLE TRIGGER "Identity_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "Identity" ADD CONSTRAINT "Identity_loginPhoneFullNumber_e164" CHECK ("loginPhoneFullNumber" ~ '^\\+[1-9][0-9]{7,14}$')`);
        await queryRunner.query(`ALTER TABLE "Identity" ADD CONSTRAINT "Identity_loginPhoneNationalNumber_fmt" CHECK ("loginPhoneNationalNumber" ~ '^[0-9]{4,15}$')`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP CONSTRAINT "Identity_login_present"`);
        await queryRunner.query(`ALTER TABLE "Identity" ADD CONSTRAINT "Identity_login_present" CHECK ("email" IS NOT NULL OR "loginPhoneFullNumber" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP CONSTRAINT "Identity_phoneId_fkey"`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP CONSTRAINT "Identity_phoneId_key"`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP COLUMN "phoneId"`);
        await queryRunner.query(`DROP TABLE "Phone"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "Phone" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "countryCode" "public"."CountryCodeEnum" NOT NULL, "rawNumber" character varying(32) NOT NULL, "fullNumber" character varying(16) NOT NULL, "nationalNumber" character varying(15) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "Phone_fullNumber_e164" CHECK ("fullNumber" ~ '^\\+[1-9][0-9]{7,14}$'), CONSTRAINT "Phone_nationalNumber_fmt" CHECK ("nationalNumber" ~ '^[0-9]{4,15}$'), CONSTRAINT "Phone_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "Phone_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TRIGGER "Phone_setUpdatedAt" BEFORE UPDATE ON "Phone" FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"()`);
        await queryRunner.query(`ALTER TABLE "Phone" ADD "identityId" integer`);
        await queryRunner.query(`INSERT INTO "Phone" ("countryCode", "rawNumber", "fullNumber", "nationalNumber", "createdAt", "updatedAt", "identityId") SELECT "loginPhoneCountryCode", "loginPhoneRawNumber", "loginPhoneFullNumber", "loginPhoneNationalNumber", "createdAt", "createdAt", "id" FROM "Identity" WHERE "loginPhoneFullNumber" IS NOT NULL ORDER BY "id"`);
        await queryRunner.query(`ALTER TABLE "Identity" ADD "phoneId" "uint"`);
        await queryRunner.query(`ALTER TABLE "Identity" DISABLE TRIGGER "Identity_setUpdatedAt"`);
        await queryRunner.query(`UPDATE "Identity" AS i SET "phoneId" = p."id" FROM "Phone" AS p WHERE p."identityId" = i."id"`);
        await queryRunner.query(`ALTER TABLE "Identity" ENABLE TRIGGER "Identity_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "Phone" DROP COLUMN "identityId"`);
        await queryRunner.query(`ALTER TABLE "Identity" ADD CONSTRAINT "Identity_phoneId_key" UNIQUE ("phoneId")`);
        await queryRunner.query(`ALTER TABLE "Identity" ADD CONSTRAINT "Identity_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "Phone"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP CONSTRAINT "Identity_login_present"`);
        await queryRunner.query(`ALTER TABLE "Identity" ADD CONSTRAINT "Identity_login_present" CHECK ("email" IS NOT NULL OR "phoneId" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP CONSTRAINT "Identity_loginPhoneNationalNumber_fmt"`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP CONSTRAINT "Identity_loginPhoneFullNumber_e164"`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP COLUMN "loginPhoneNationalNumber"`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP COLUMN "loginPhoneFullNumber"`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP COLUMN "loginPhoneRawNumber"`);
        await queryRunner.query(`ALTER TABLE "Identity" DROP COLUMN "loginPhoneCountryCode"`);
    }

}
