export interface ShipmentQuoteInput {
  fromPostalCode: string;
  toPostalCode: string;
  weightKg: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

export interface ShipmentQuote {
  providerId: string;
  providerName: string;
  serviceName: string;
  priceCents: number;
  deliveryDays: number;
  externalId: string;
}

export interface LabelPurchaseResult {
  trackingCode: string;
  shipmentId: string;
  labelUrl?: string;
}

export interface CarrierProvider {
  id: string;
  name: string;
  quote(input: ShipmentQuoteInput, token: string): Promise<ShipmentQuote[]>;
  purchaseLabel(quoteId: string, token: string): Promise<LabelPurchaseResult>;
  getTracking(shipmentId: string, token: string): Promise<{ status: string }>;
}
