import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderConfirmation1791000000150 implements MigrationInterface {
    name = 'AddOrderConfirmation1791000000150'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "OrderInbox" ("consumer" character varying(100) NOT NULL, "messageId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "OrderInbox_pkey" PRIMARY KEY ("consumer", "messageId"))`);
        await queryRunner.query(`CREATE TABLE "OrderConfirmation" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "orderPublicId" uuid NOT NULL, "userId" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "OrderConfirmation_orderPublicId_key" UNIQUE ("orderPublicId"), CONSTRAINT "OrderConfirmation_pkey" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "OrderConfirmation"`);
        await queryRunner.query(`DROP TABLE "OrderInbox"`);
    }

}
