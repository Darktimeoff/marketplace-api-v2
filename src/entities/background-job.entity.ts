import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { BackgroundJobStatusEnum, BackgroundJobTypeEnum } from './enums.js';
import { Order } from '../order/entity/order.entity.js';

/**
 * Очередь фоновых задач (пока только тип ORDER — асинхронная обработка заказа).
 * dedupeKey уникален: повторная постановка одной и той же задачи не должна
 * создавать дубликат, дедуп делает БД, а не код на каждый INSERT.
 */
@Entity('BackgroundJob')
@Unique('BackgroundJob_dedupeKey_key', ['dedupeKey'])
@Check('BackgroundJob_dedupeKey_notBlank', `btrim("dedupeKey") <> ''`)
@Check('BackgroundJob_attempts_nonneg', `"attempts" >= 0`)
@Check('BackgroundJob_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class BackgroundJob {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'enum', enum: BackgroundJobTypeEnum, enumName: 'BackgroundJobTypeEnum' })
  type: BackgroundJobTypeEnum;

  @Column({ type: 'enum', enum: BackgroundJobStatusEnum, enumName: 'BackgroundJobStatusEnum', default: BackgroundJobStatusEnum.QUEUED })
  status: BackgroundJobStatusEnum;

  // jsonb, а не json: поддерживает индексацию и containment-запросы (@>),
  // и это единственная причина вообще выбирать между ними в Postgres.
  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'varchar', length: 255 })
  dedupeKey: string;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'integer', default: 0 })
  attempts: number;

  @Column({ type: 'integer', nullable: true })
  orderId: number | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // RESTRICT: удаление заказа не должно молча уносить историю его обработки.
  @ManyToOne(() => Order, (order) => order.backgroundJobs, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;
}
