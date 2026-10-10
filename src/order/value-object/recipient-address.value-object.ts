import { Column } from 'typeorm';

export class RecipientAddress {
  @Column({ name: 'addressLine', type: 'varchar', length: 255 })
  addressLine: string;

  @Column({ name: 'addressCity', type: 'varchar', length: 100 })
  city: string;

  @Column({ name: 'addressBuilding', type: 'varchar', length: 32, nullable: true })
  building: string | null;
}
