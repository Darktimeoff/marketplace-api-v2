export interface OrderRecipientEntityInterface {
  id: number;
  buyerId: number;
  fullName: string;
  phoneId: number;
  deliveryAddressId: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
