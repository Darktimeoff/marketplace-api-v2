import { MigrationInterface, QueryRunner } from "typeorm";

export class OrderOwnsUserAndContact1791000000000 implements MigrationInterface {
    name = 'OrderOwnsUserAndContact1791000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM "OrderRecipient" AS r WHERE NOT EXISTS (SELECT 1 FROM "Order" AS o WHERE o."orderRecipientId" = r."id")) THEN RAISE EXCEPTION 'OrderRecipient rows without an Order cannot be migrated'; END IF; END $$`);
        await queryRunner.query(`ALTER TABLE "Order" ADD "userId" "uint"`);
        await queryRunner.query(`ALTER TABLE "Order" DISABLE TRIGGER "Order_setUpdatedAt"`);
        await queryRunner.query(`UPDATE "Order" AS o SET "userId" = r."buyerId" FROM "OrderRecipient" AS r WHERE r."id" = o."orderRecipientId"`);
        await queryRunner.query(`ALTER TABLE "Order" ENABLE TRIGGER "Order_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "Order" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD "phoneCountryCode" "public"."CountryCodeEnum"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD "phoneRawNumber" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD "phoneFullNumber" character varying(16)`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD "phoneNationalNumber" character varying(15)`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD "addressLine" character varying(255)`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD "addressCity" character varying(100)`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD "addressBuilding" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DISABLE TRIGGER "OrderRecipient_setUpdatedAt"`);
        await queryRunner.query(`UPDATE "OrderRecipient" AS r SET "phoneCountryCode" = p."countryCode", "phoneRawNumber" = p."rawNumber", "phoneFullNumber" = p."fullNumber", "phoneNationalNumber" = p."nationalNumber", "addressLine" = a."addressLine", "addressCity" = a."city", "addressBuilding" = a."building" FROM "Phone" AS p, "DeliveryAddress" AS a WHERE p."id" = r."phoneId" AND a."id" = r."deliveryAddressId"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ENABLE TRIGGER "OrderRecipient_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ALTER COLUMN "phoneCountryCode" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ALTER COLUMN "phoneRawNumber" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ALTER COLUMN "phoneFullNumber" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ALTER COLUMN "phoneNationalNumber" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ALTER COLUMN "addressLine" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ALTER COLUMN "addressCity" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD CONSTRAINT "OrderRecipient_phoneFullNumber_e164" CHECK ("phoneFullNumber" ~ '^\\+[1-9][0-9]{7,14}$')`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD CONSTRAINT "OrderRecipient_phoneNationalNumber_fmt" CHECK ("phoneNationalNumber" ~ '^[0-9]{4,15}$')`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP CONSTRAINT "OrderRecipient_buyerId_fkey"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP CONSTRAINT "OrderRecipient_phoneId_fkey"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP CONSTRAINT "OrderRecipient_deliveryAddressId_fkey"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP CONSTRAINT "OrderRecipient_phoneId_key"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP CONSTRAINT "OrderRecipient_deliveryAddressId_key"`);
        await queryRunner.query(`DELETE FROM "Phone" WHERE "id" IN (SELECT "phoneId" FROM "OrderRecipient") AND "id" NOT IN (SELECT "phoneId" FROM "Identity" WHERE "phoneId" IS NOT NULL)`);
        await queryRunner.query(`DELETE FROM "DeliveryAddress" WHERE "id" IN (SELECT "deliveryAddressId" FROM "OrderRecipient") AND "id" NOT IN (SELECT "deliveryAddressId" FROM "User" WHERE "deliveryAddressId" IS NOT NULL)`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP COLUMN "buyerId"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP COLUMN "phoneId"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP COLUMN "deliveryAddressId"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Phone" ADD "recipientId" integer`);
        await queryRunner.query(`ALTER TABLE "DeliveryAddress" ADD "recipientId" integer`);
        await queryRunner.query(`INSERT INTO "Phone" ("countryCode", "rawNumber", "fullNumber", "nationalNumber", "createdAt", "updatedAt", "recipientId") SELECT "phoneCountryCode", "phoneRawNumber", "phoneFullNumber", "phoneNationalNumber", "createdAt", "createdAt", "id" FROM "OrderRecipient" ORDER BY "id"`);
        await queryRunner.query(`INSERT INTO "DeliveryAddress" ("addressLine", "city", "building", "createdAt", "updatedAt", "recipientId") SELECT "addressLine", "addressCity", "addressBuilding", "createdAt", "createdAt", "id" FROM "OrderRecipient" ORDER BY "id"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD "buyerId" "uint"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD "phoneId" "uint"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD "deliveryAddressId" "uint"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DISABLE TRIGGER "OrderRecipient_setUpdatedAt"`);
        await queryRunner.query(`UPDATE "OrderRecipient" AS r SET "buyerId" = o."userId", "phoneId" = p."id", "deliveryAddressId" = a."id" FROM "Order" AS o, "Phone" AS p, "DeliveryAddress" AS a WHERE o."orderRecipientId" = r."id" AND p."recipientId" = r."id" AND a."recipientId" = r."id"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ENABLE TRIGGER "OrderRecipient_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ALTER COLUMN "buyerId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ALTER COLUMN "phoneId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ALTER COLUMN "deliveryAddressId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD CONSTRAINT "OrderRecipient_phoneId_key" UNIQUE ("phoneId")`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD CONSTRAINT "OrderRecipient_deliveryAddressId_key" UNIQUE ("deliveryAddressId")`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD CONSTRAINT "OrderRecipient_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD CONSTRAINT "OrderRecipient_phoneId_fkey" FOREIGN KEY ("phoneId") REFERENCES "Phone"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" ADD CONSTRAINT "OrderRecipient_deliveryAddressId_fkey" FOREIGN KEY ("deliveryAddressId") REFERENCES "DeliveryAddress"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "Phone" DROP COLUMN "recipientId"`);
        await queryRunner.query(`ALTER TABLE "DeliveryAddress" DROP COLUMN "recipientId"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP CONSTRAINT "OrderRecipient_phoneNationalNumber_fmt"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP CONSTRAINT "OrderRecipient_phoneFullNumber_e164"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP COLUMN "addressBuilding"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP COLUMN "addressCity"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP COLUMN "addressLine"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP COLUMN "phoneNationalNumber"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP COLUMN "phoneFullNumber"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP COLUMN "phoneRawNumber"`);
        await queryRunner.query(`ALTER TABLE "OrderRecipient" DROP COLUMN "phoneCountryCode"`);
        await queryRunner.query(`ALTER TABLE "Order" DROP COLUMN "userId"`);
    }

}
