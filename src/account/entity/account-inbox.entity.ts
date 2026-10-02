import { CreateDateColumn, DeleteDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { type AccountInboxEntityInterface } from '@marketplace/contracts-core';

@Entity('AccountInbox')
export class AccountInbox implements AccountInboxEntityInterface {
  @PrimaryColumn({ type: 'varchar', length: 100, primaryKeyConstraintName: 'AccountInbox_pkey' })
  consumer: string;

  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'AccountInbox_pkey' })
  messageId: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

export interface AccountInboxCreateEntityInterface extends Pick<AccountInbox, 'consumer' | 'messageId'> {}
