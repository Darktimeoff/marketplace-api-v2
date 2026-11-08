import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('OrderBuyer')
export class OrderBuyer {
  @PrimaryGeneratedColumn('identity', { type: 'integer', generatedIdentity: 'ALWAYS', primaryKeyConstraintName: 'OrderBuyer_pkey' })
  id: number;

  @Column({ type: 'uuid', unique: true })
  publicId: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;
}

export interface OrderBuyerCreateEntityInterface extends Pick<OrderBuyer, 'publicId'> {}
