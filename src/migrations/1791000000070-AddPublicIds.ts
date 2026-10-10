import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPublicIds1791000000070 implements MigrationInterface {
    name = 'AddPublicIds1791000000070'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "User" ADD "publicId" uuid NOT NULL DEFAULT gen_random_uuid()`);
        await queryRunner.query(`ALTER TABLE "User" ADD CONSTRAINT "User_publicId_key" UNIQUE ("publicId")`);
        await queryRunner.query(`ALTER TABLE "Address" ADD "publicId" uuid NOT NULL DEFAULT gen_random_uuid()`);
        await queryRunner.query(`ALTER TABLE "Address" ADD CONSTRAINT "Address_publicId_key" UNIQUE ("publicId")`);
        await queryRunner.query(`ALTER TABLE "Seller" ADD "publicId" uuid NOT NULL DEFAULT gen_random_uuid()`);
        await queryRunner.query(`ALTER TABLE "Seller" ADD CONSTRAINT "Seller_publicId_key" UNIQUE ("publicId")`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD "publicId" uuid NOT NULL DEFAULT gen_random_uuid()`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" ADD CONSTRAINT "SellerOffer_publicId_key" UNIQUE ("publicId")`);
        await queryRunner.query(`ALTER TABLE "Product" ADD "publicId" uuid NOT NULL DEFAULT gen_random_uuid()`);
        await queryRunner.query(`ALTER TABLE "Product" ADD CONSTRAINT "Product_publicId_key" UNIQUE ("publicId")`);
        await queryRunner.query(`ALTER TABLE "ProductVariant" ADD "publicId" uuid NOT NULL DEFAULT gen_random_uuid()`);
        await queryRunner.query(`ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_publicId_key" UNIQUE ("publicId")`);
        await queryRunner.query(`ALTER TABLE "Category" ADD "publicId" uuid NOT NULL DEFAULT gen_random_uuid()`);
        await queryRunner.query(`ALTER TABLE "Category" ADD CONSTRAINT "Category_publicId_key" UNIQUE ("publicId")`);
        await queryRunner.query(`ALTER TABLE "Brand" ADD "publicId" uuid NOT NULL DEFAULT gen_random_uuid()`);
        await queryRunner.query(`ALTER TABLE "Brand" ADD CONSTRAINT "Brand_publicId_key" UNIQUE ("publicId")`);
        await queryRunner.query(`ALTER TABLE "Transaction" ADD "publicId" uuid NOT NULL DEFAULT gen_random_uuid()`);
        await queryRunner.query(`ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_publicId_key" UNIQUE ("publicId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_publicId_key"`);
        await queryRunner.query(`ALTER TABLE "Transaction" DROP COLUMN "publicId"`);
        await queryRunner.query(`ALTER TABLE "Brand" DROP CONSTRAINT "Brand_publicId_key"`);
        await queryRunner.query(`ALTER TABLE "Brand" DROP COLUMN "publicId"`);
        await queryRunner.query(`ALTER TABLE "Category" DROP CONSTRAINT "Category_publicId_key"`);
        await queryRunner.query(`ALTER TABLE "Category" DROP COLUMN "publicId"`);
        await queryRunner.query(`ALTER TABLE "ProductVariant" DROP CONSTRAINT "ProductVariant_publicId_key"`);
        await queryRunner.query(`ALTER TABLE "ProductVariant" DROP COLUMN "publicId"`);
        await queryRunner.query(`ALTER TABLE "Product" DROP CONSTRAINT "Product_publicId_key"`);
        await queryRunner.query(`ALTER TABLE "Product" DROP COLUMN "publicId"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP CONSTRAINT "SellerOffer_publicId_key"`);
        await queryRunner.query(`ALTER TABLE "SellerOffer" DROP COLUMN "publicId"`);
        await queryRunner.query(`ALTER TABLE "Seller" DROP CONSTRAINT "Seller_publicId_key"`);
        await queryRunner.query(`ALTER TABLE "Seller" DROP COLUMN "publicId"`);
        await queryRunner.query(`ALTER TABLE "Address" DROP CONSTRAINT "Address_publicId_key"`);
        await queryRunner.query(`ALTER TABLE "Address" DROP COLUMN "publicId"`);
        await queryRunner.query(`ALTER TABLE "User" DROP CONSTRAINT "User_publicId_key"`);
        await queryRunner.query(`ALTER TABLE "User" DROP COLUMN "publicId"`);
    }

}
