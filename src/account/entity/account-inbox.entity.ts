import { CreateDateColumn, DeleteDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('AccountInbox')
export class AccountInbox {
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
