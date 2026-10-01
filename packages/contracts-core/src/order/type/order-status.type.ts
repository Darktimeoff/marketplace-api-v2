export type OrderStatus =
  | 'created'
  | 'pending_payment'
  | 'failed_payment'
  | 'paid'
  | 'confirmed'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'canceled'
  | 'refunded';
