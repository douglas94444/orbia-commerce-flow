import { countProductFiscalStats, getSkusMissingNcm } from "./product-fiscal.server";

export interface ProductFiscalReadinessResult {
  ready: boolean;
  totalActive: number;
  withNcm: number;
  incomplete: number;
  coveragePct: number;
  missingSkus: Array<{ sku: string; name: string }>;
}

export async function validateProductFiscalReadiness(
  clientId: string,
): Promise<ProductFiscalReadinessResult> {
  const [stats, missingSkus] = await Promise.all([
    countProductFiscalStats(clientId),
    getSkusMissingNcm(clientId, 8),
  ]);

  const coveragePct =
    stats.totalActive > 0 ? Math.round((stats.withNcm / stats.totalActive) * 100) : 100;

  return {
    ready: stats.incomplete === 0 && stats.totalActive > 0,
    totalActive: stats.totalActive,
    withNcm: stats.withNcm,
    incomplete: stats.incomplete,
    coveragePct,
    missingSkus,
  };
}
