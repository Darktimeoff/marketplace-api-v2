export interface DeliveryAddressEntityInterface {
  id: number;
  addressLine: string;
  city: string;
  building: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
