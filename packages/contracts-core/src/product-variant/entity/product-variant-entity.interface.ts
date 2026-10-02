export interface ProductVariantEntityInterface {
  id: number;
  productId: number;
  sku: string;
  barcode: string | null;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
