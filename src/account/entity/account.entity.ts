import { CreateDateColumn, Entity, Column, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { moneyTransformer } from '../../generic/transformer/money.transformer.js';
import type { Transaction } from './transaction.entity.js';

@Entity('Account')
export class Account {
  @PrimaryColumn({ type: 'integer', primaryKeyConstraintName: 'Account_pkey' })
  customerId: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: moneyTransformer })
  balance: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @OneToMany('Transaction', (transaction: Transaction) => transaction.account)
  transactions: Transaction[];
}
