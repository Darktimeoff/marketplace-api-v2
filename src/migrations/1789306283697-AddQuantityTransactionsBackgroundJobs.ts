import { MigrationInterface, QueryRunner } from "typeorm"

/**
 * Диф поверх InitSchema: остаток товара у ProductOffer, денежные проводки
 * пользователя (Transaction) и очередь фоновых задач (BackgroundJob).
 *
 * Получена через `typeorm migration:generate` и урезана руками: генератор
 * сравнивает живую БД со своими метаданными и, не находя в них свои же старые
 * имена FK-констрейнтов (Xxx_fkey, как в исходной схеме ДЗ #12), решил, что все 17
 * существующих внешних ключей "изменились" — и выдал DROP+ADD на каждый,
 * хотя ни один из них по факту не поменялся. Та же история с "fullName"
 * (generated-колонка) и дефолтом "publicId" — генератор не смог сравнить их
 * с метаданными 1:1 и предложил пересоздать оба без единого содержательного
 * изменения. Всё это отсюда убрано; ниже — только реальный диф.
 */
export class AddQuantityTransactionsBackgroundJobs1789306283697 implements MigrationInterface {
    name = 'AddQuantityTransactionsBackgroundJobs1789306283697'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Остаток товара на складе — integer со своим CHECK, а не домен "uint":
        // тот запрещает 0 (VALUE > 0), а распроданный оффер (quantity = 0) — норма.
        await queryRunner.query(`ALTER TABLE "ProductOffer" ADD COLUMN "quantity" integer NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_quantity_nonneg" CHECK ("quantity" >= 0)`);

        await queryRunner.query(`CREATE TYPE "public"."TransactionTypeEnum" AS ENUM('DEPOSIT', 'PAYMENT', 'WITHDRAWAL')`);
        await queryRunner.query(`CREATE TYPE "public"."TransactionStatusEnum" AS ENUM('PENDING', 'FAILED', 'SUCCESS')`);
        await queryRunner.query(`CREATE TABLE "Transaction" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "userId" "uint" NOT NULL, "amount" "amount" NOT NULL, "status" "public"."TransactionStatusEnum" NOT NULL DEFAULT 'PENDING', "type" "public"."TransactionTypeEnum" NOT NULL DEFAULT 'PAYMENT', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "Transaction_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TYPE "public"."BackgroundJobTypeEnum" AS ENUM('ORDER')`);
        await queryRunner.query(`CREATE TYPE "public"."BackgroundJobStatusEnum" AS ENUM('QUEUED', 'PROCESSING', 'READY', 'FAILED', 'INTERRUPTED')`);
        await queryRunner.query(`CREATE TABLE "BackgroundJob" ("id" integer GENERATED ALWAYS AS IDENTITY NOT NULL, "type" "public"."BackgroundJobTypeEnum" NOT NULL, "status" "public"."BackgroundJobStatusEnum" NOT NULL DEFAULT 'QUEUED', "payload" jsonb NOT NULL, "dedupeKey" character varying(255) NOT NULL, "startedAt" TIMESTAMP WITH TIME ZONE, "finishedAt" TIMESTAMP WITH TIME ZONE, "errorMessage" text, "attempts" integer NOT NULL DEFAULT 0, "orderId" "uint", "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "BackgroundJob_dedupeKey_key" UNIQUE ("dedupeKey"), CONSTRAINT "BackgroundJob_dedupeKey_notBlank" CHECK (btrim("dedupeKey") <> ''), CONSTRAINT "BackgroundJob_attempts_nonneg" CHECK ("attempts" >= 0), CONSTRAINT "BackgroundJob_deletedAt_order" CHECK ("deletedAt" IS NULL OR "deletedAt" >= "createdAt"), CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);

        for (const table of ["Transaction", "BackgroundJob"]) {
            await queryRunner.query(`CREATE TRIGGER "${table}_setUpdatedAt" BEFORE UPDATE ON "${table}" FOR EACH ROW EXECUTE FUNCTION "setUpdatedAt"()`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "BackgroundJob"`);
        await queryRunner.query(`DROP TYPE "public"."BackgroundJobStatusEnum"`);
        await queryRunner.query(`DROP TYPE "public"."BackgroundJobTypeEnum"`);

        await queryRunner.query(`DROP TABLE "Transaction"`);
        await queryRunner.query(`DROP TYPE "public"."TransactionStatusEnum"`);
        await queryRunner.query(`DROP TYPE "public"."TransactionTypeEnum"`);

        await queryRunner.query(`ALTER TABLE "ProductOffer" DROP CONSTRAINT "ProductOffer_quantity_nonneg"`);
        await queryRunner.query(`ALTER TABLE "ProductOffer" DROP COLUMN "quantity"`);
    }
}
