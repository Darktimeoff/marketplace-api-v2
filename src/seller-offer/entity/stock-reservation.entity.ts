import { Check, Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { SellerOffer } from './seller-offer.entity.js';

@Entity('StockReservation')
@Check('StockReservation_quantity_positive', `"quantity" > 0`)
export class StockReservation {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'StockReservation_pkey' })
  orderPublicId: string;

  @PrimaryColumn({ type: 'integer', primaryKeyConstraintName: 'StockReservation_pkey' })
  offerId: number;

  @Column({ type: 'integer' })
  quantity: number;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;

  @ManyToOne(() => SellerOffer, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'offerId', foreignKeyConstraintName: 'StockReservation_offerId_fkey' })
  offer: SellerOffer;
}

export interface StockReservationCreateEntityInterface extends Pick<StockReservation, 'orderPublicId' | 'offerId' | 'quantity'> {}
