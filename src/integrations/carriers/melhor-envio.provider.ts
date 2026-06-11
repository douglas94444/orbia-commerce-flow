import {
  getTracking,
  purchaseLabel,
  quoteShipment,
} from "@/integrations/melhor-envio/client";
import type { CarrierProvider, ShipmentQuote, ShipmentQuoteInput } from "./types";

export const melhorEnvioProvider: CarrierProvider = {
  id: "melhor_envio",
  name: "Melhor Envio",

  async quote(input: ShipmentQuoteInput, token: string): Promise<ShipmentQuote[]> {
    const quotes = await quoteShipment(token, {
      toPostalCode: input.toPostalCode,
      weightKg: input.weightKg,
    });
    return quotes.map((q) => ({
      providerId: "melhor_envio",
      providerName: q.company?.name ?? "Melhor Envio",
      serviceName: q.name,
      priceCents: Math.round(parseFloat(q.price) * 100),
      deliveryDays: 5,
      externalId: String(q.id),
    }));
  },

  async purchaseLabel(quoteId: string, token: string) {
    const label = await purchaseLabel(token, quoteId);
    return {
      trackingCode: label.tracking,
      shipmentId: label.id,
      labelUrl: label.url,
    };
  },

  async getTracking(shipmentId: string, token: string) {
    const t = await getTracking(token, shipmentId);
    return { status: t.status };
  },
};
