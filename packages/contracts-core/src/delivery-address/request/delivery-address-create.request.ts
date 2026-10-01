export interface DeliveryAddressCreateRequest {
  addressLine: string;
  city: string;
  building?: string | null;
}
