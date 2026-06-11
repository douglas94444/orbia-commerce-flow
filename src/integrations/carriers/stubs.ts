import type { CarrierProvider } from "./types";

function stubProvider(id: string, name: string): CarrierProvider {
  return {
    id,
    name,
    async quote() {
      // Correios, Jadlog etc. são cotados via Melhor Envio (proxy) — configure melhor_envio ativo.
      return [];
    },
    async purchaseLabel() {
      throw new Error(
        `${name} — use Melhor Envio como proxy (cota múltiplas transportadoras). Integração direta em roadmap.`,
      );
    },
    async getTracking() {
      return { status: "unknown" };
    },
  };
}

export const jadlogProvider = stubProvider("jadlog", "Jadlog");
export const jtExpressProvider = stubProvider("jt_express", "J&T Express");
export const totalExpressProvider = stubProvider("total_express", "Total Express");
export const latamCargoProvider = stubProvider("latam_cargo", "Latam Cargo");
export const azulCargoProvider = stubProvider("azul_cargo", "Azul Cargo");
export const correiosProvider = stubProvider("correios", "Correios");
