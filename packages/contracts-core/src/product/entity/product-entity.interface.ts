export interface ProductEntityInterface {
  id: number;
  categoryId: number;
  brandId: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
