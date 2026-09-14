import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { TransactionStatusEnum, TransactionTypeEnum } from './enums.js';
import { User } from './user.entity.js';
import { moneyTransformer } from './money.transformer.js';

/**
 * Денежная проводка пользователя: пополнение, оплата, вывод средств.
 * amount — всегда неотрицательная величина (тот же домен "amount", что и у
 * денег в остальной схеме); направление денег кодирует "type", а не знак числа.
 */
@Entity('Transaction')
@Check('Transaction_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
export class Transaction {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  userId: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: moneyTransformer })
  amount: string;

  @Column({ type: 'enum', enum: TransactionStatusEnum, enumName: 'TransactionStatusEnum', default: TransactionStatusEnum.PENDING })
  status: TransactionStatusEnum;

  @Column({ type: 'enum', enum: TransactionTypeEnum, enumName: 'TransactionTypeEnum', default: TransactionTypeEnum.PAYMENT })
  type: TransactionTypeEnum;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  // RESTRICT: финансовая история пользователя не должна исчезать вместе с ним.
  @ManyToOne(() => User, (user) => user.transactions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'userId' })
  user: User;
}

export interface TransactionCreateEntityInterface
  extends Pick<Transaction, 'userId' | 'amount' | 'type' | 'status'> {}
