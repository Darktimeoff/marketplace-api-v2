import { Column, CreateDateColumn, Entity, PrimaryColumn, Unique } from 'typeorm';

@Entity('OrderBuyer')
@Unique('OrderBuyer_userId_key', ['userId'])
export class OrderBuyer {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'OrderBuyer_pkey' })
  identityPublicId: string;

  @Column({ type: 'integer' })
  userId: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}

export interface OrderBuyerCreateEntityInterface extends Pick<OrderBuyer, 'identityPublicId' | 'userId'> {}
