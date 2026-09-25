export interface InsufficientStockProductInterface {
  offerId: number;
  requestedQuantity: number;
  stockQuantity: number | null;
}