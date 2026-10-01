import {  CreateDateColumn, DeleteDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('EmailInbox')
export class EmailInbox {
  @PrimaryColumn({ type: 'uuid' })
  messageId: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
