import { CreateDateColumn, DeleteDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('Inbox')
export class Inbox {
  @PrimaryColumn({ type: 'varchar', length: 100, primaryKeyConstraintName: 'Inbox_pkey' })
  consumer: string;

  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'Inbox_pkey' })
  messageId: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

export interface InboxCreateEntityInterface extends Pick<Inbox, 'consumer' | 'messageId'> {}
