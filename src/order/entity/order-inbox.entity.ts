// TODO(hw-22): remove after homework, the OrderConfirmation consumer exists only for the outbox demos
import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('OrderInbox')
export class OrderInbox {
  @PrimaryColumn({ type: 'varchar', length: 100, primaryKeyConstraintName: 'OrderInbox_pkey' })
  consumer: string;

  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'OrderInbox_pkey' })
  messageId: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}

export interface OrderInboxCreateEntityInterface extends Pick<OrderInbox, 'consumer' | 'messageId'> {}
