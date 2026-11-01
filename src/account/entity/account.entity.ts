import { CreateDateColumn, Entity, Column, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { moneyTransformer } from '../../generic/transformer/money.transformer.js';
import type { Transaction } from './transaction.entity.js';

@Entity('Account')
export class Account {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS', primaryKeyConstraintName: 'Account_pkey' })
  id: number;

  @Column({ type: 'uuid', unique: true })
  publicId: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: moneyTransformer })
  balance: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany('Transaction', (transaction: Transaction) => transaction.account)
  transactions: Transaction[];
}
