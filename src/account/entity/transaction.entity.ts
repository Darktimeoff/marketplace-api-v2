import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Account } from './account.entity.js';
import { moneyTransformer } from '../../generic/transformer/money.transformer.js';
import { TransactionStatusEnum, TransactionTypeEnum, type TransactionEntityInterface } from '@marketplace/contracts-core';

/**
 * Денежная проводка пользователя: пополнение, оплата, вывод средств.
 * amount — всегда неотрицательная величина (тот же домен "amount", что и у
 * денег в остальной схеме); направление денег кодирует "type", а не знак числа.
 */
@Entity('Transaction')
@Check('Transaction_deletedAt_order', `"deletedAt" IS NULL OR "deletedAt" >= "createdAt"`)
@Index('Transaction_customerId_idx', ['customerId'])
export class Transaction implements TransactionEntityInterface {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS' })
  id: number;

  @Column({ type: 'integer' })
  customerId: number;

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
  @ManyToOne(() => Account, (account) => account.transactions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customerId', foreignKeyConstraintName: 'Transaction_customerId_fkey' })
  account: Account;
}

export interface TransactionCreateEntityInterface
  extends Pick<Transaction, 'customerId' | 'amount' | 'type' | 'status'> {}
