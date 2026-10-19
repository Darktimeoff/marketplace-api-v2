// TODO(hw-22): remove after homework, the OrderConfirmation consumer exists only for the outbox demos
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('OrderConfirmation')
@Unique('OrderConfirmation_orderPublicId_key', ['orderPublicId'])
export class OrderConfirmation {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS', primaryKeyConstraintName: 'OrderConfirmation_pkey' })
  id: number;

  @Column({ type: 'uuid' })
  orderPublicId: string;

  @Column({ type: 'integer' })
  userId: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}

export interface OrderConfirmationCreateEntityInterface extends Pick<OrderConfirmation, 'orderPublicId' | 'userId'> {}
