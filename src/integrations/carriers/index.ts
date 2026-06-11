import { melhorEnvioProvider } from "./melhor-envio.provider";
import {
  azulCargoProvider,
  correiosProvider,
  jadlogProvider,
  jtExpressProvider,
  latamCargoProvider,
  totalExpressProvider,
} from "./stubs";
import type { CarrierProvider, ShipmentQuote, ShipmentQuoteInput } from "./types";

export type { CarrierProvider, ShipmentQuote, ShipmentQuoteInput };

const PROVIDERS: Record<string, CarrierProvider> = {
  melhor_envio: melhorEnvioProvider,
  correios: correiosProvider,
  jadlog: jadlogProvider,
  jt_express: jtExpressProvider,
  total_express: totalExpressProvider,
  latam_cargo: latamCargoProvider,
  azul_cargo: azulCargoProvider,
};

export function getCarrierProvider(id: string): CarrierProvider | undefined {
  return PROVIDERS[id];
}

export function listCarrierProviders(): CarrierProvider[] {
  return Object.values(PROVIDERS);
}

export async function quoteAllCarriers(
  providerIds: string[],
  input: ShipmentQuoteInput,
  tokens: Record<string, string>,
): Promise<ShipmentQuote[]> {
  const all: ShipmentQuote[] = [];
  for (const id of providerIds) {
    const provider = PROVIDERS[id];
    const token = tokens[id];
    if (!provider || !token) continue;
    try {
      const quotes = await provider.quote(input, token);
      all.push(...quotes);
    } catch (err) {
      console.error(`[carriers] quote ${id} failed:`, err);
    }
  }
  return all.sort((a, b) => a.priceCents - b.priceCents);
}
