export interface InsufficientStockProductInterface {
  productOfferId: number;
  requestedQuantity: number;
  stockQuantity: number | null;
}