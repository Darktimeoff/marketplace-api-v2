import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameDeliveryAddressToAddress1791000000020 implements MigrationInterface {
    name = 'RenameDeliveryAddressToAddress1791000000020'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "User" DROP CONSTRAINT "User_identityId_fkey"`);
        await queryRunner.query(`ALTER TABLE "DeliveryAddress" RENAME TO "Address"`);
        await queryRunner.query(`ALTER TABLE "Address" RENAME CONSTRAINT "DeliveryAddress_pkey" TO "Address_pkey"`);
        await queryRunner.query(`ALTER TABLE "Address" RENAME CONSTRAINT "DeliveryAddress_deletedAt_order" TO "Address_deletedAt_order"`);
        await queryRunner.query(`ALTER TRIGGER "DeliveryAddress_setUpdatedAt" ON "Address" RENAME TO "Address_setUpdatedAt"`);
        await queryRunner.query(`ALTER SEQUENCE "DeliveryAddress_id_seq" RENAME TO "Address_id_seq"`);
        await queryRunner.query(`ALTER TABLE "User" RENAME COLUMN "deliveryAddressId" TO "addressId"`);
        await queryRunner.query(`ALTER TABLE "User" RENAME CONSTRAINT "User_deliveryAddressId_fkey" TO "User_addressId_fkey"`);
        await queryRunner.query(`ALTER TABLE "User" RENAME CONSTRAINT "User_deliveryAddressId_key" TO "User_addressId_key"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "User" RENAME CONSTRAINT "User_addressId_key" TO "User_deliveryAddressId_key"`);
        await queryRunner.query(`ALTER TABLE "User" RENAME CONSTRAINT "User_addressId_fkey" TO "User_deliveryAddressId_fkey"`);
        await queryRunner.query(`ALTER TABLE "User" RENAME COLUMN "addressId" TO "deliveryAddressId"`);
        await queryRunner.query(`ALTER SEQUENCE "Address_id_seq" RENAME TO "DeliveryAddress_id_seq"`);
        await queryRunner.query(`ALTER TRIGGER "Address_setUpdatedAt" ON "Address" RENAME TO "DeliveryAddress_setUpdatedAt"`);
        await queryRunner.query(`ALTER TABLE "Address" RENAME CONSTRAINT "Address_deletedAt_order" TO "DeliveryAddress_deletedAt_order"`);
        await queryRunner.query(`ALTER TABLE "Address" RENAME CONSTRAINT "Address_pkey" TO "DeliveryAddress_pkey"`);
        await queryRunner.query(`ALTER TABLE "Address" RENAME TO "DeliveryAddress"`);
        await queryRunner.query(`ALTER TABLE "User" ADD CONSTRAINT "User_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

}
