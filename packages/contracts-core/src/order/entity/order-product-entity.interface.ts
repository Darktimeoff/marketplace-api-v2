export interface OrderProductEntityInterface {
  orderId: number;
  offerId: number;
  quantity: number;
  price: string;
  discountPrice: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
