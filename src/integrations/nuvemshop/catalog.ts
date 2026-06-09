import { nuvemshopFetch } from "./client";

export interface CatalogProductRow {
  sku: string;
  name: string;
  priceCents: number | null;
  externalProductId: string;
  externalVariantId: string;
  stockQty: number;
}

interface NuvemshopProduct {
  id: number;
  name: { pt?: string; es?: string };
  variants: Array<{
    id: number;
    sku: string | null;
    price: string;
    stock: number;
  }>;
}

export async function pullNuvemshopProducts(
  storeId: string,
  accessToken: string,
): Promise<CatalogProductRow[]> {
  const products = await nuvemshopFetch<NuvemshopProduct[]>(storeId, accessToken, "/products");
  const rows: CatalogProductRow[] = [];

  for (const product of products ?? []) {
    const name = product.name?.pt ?? product.name?.es ?? "Produto";
    for (const variant of product.variants ?? []) {
      const sku = variant.sku?.trim() || `NS-${variant.id}`;
      rows.push({
        sku,
        name,
        priceCents: Math.round(Number(variant.price ?? 0) * 100),
        externalProductId: String(product.id),
        externalVariantId: String(variant.id),
        stockQty: variant.stock ?? 0,
      });
    }
  }

  return rows;
}

export async function pushNuvemshopStock(
  storeId: string,
  accessToken: string,
  productId: string,
  variantId: string,
  qty: number,
): Promise<void> {
  await nuvemshopFetch(storeId, accessToken, `/products/${productId}/variants/${variantId}`, {
    method: "PUT",
    body: JSON.stringify({ stock: qty }),
  });
}
