import { shopifyFetch } from "./client";

export interface CatalogProductRow {
  sku: string;
  name: string;
  priceCents: number | null;
  externalProductId: string;
  externalVariantId: string;
  stockQty: number;
  listingMetadata?: Record<string, unknown>;
}

interface ShopifyProductsResponse {
  products: Array<{
    id: number;
    title: string;
    variants: Array<{
      id: number;
      sku: string | null;
      price: string;
      inventory_quantity: number;
      inventory_item_id: number;
    }>;
  }>;
}

interface ShopifyLocationsResponse {
  locations: Array<{ id: number; active: boolean }>;
}

export async function pullShopifyProducts(
  shop: string,
  accessToken: string,
): Promise<CatalogProductRow[]> {
  const [data, locationsData] = await Promise.all([
    shopifyFetch<ShopifyProductsResponse>(shop, accessToken, "/products.json?limit=250"),
    shopifyFetch<ShopifyLocationsResponse>(shop, accessToken, "/locations.json"),
  ]);

  const locationId =
    locationsData.locations?.find((l) => l.active)?.id ??
    locationsData.locations?.[0]?.id ??
    null;

  const rows: CatalogProductRow[] = [];

  for (const product of data.products ?? []) {
    for (const variant of product.variants ?? []) {
      const sku = variant.sku?.trim() || `SHOPIFY-${variant.id}`;
      rows.push({
        sku,
        name: product.title,
        priceCents: Math.round(Number(variant.price ?? 0) * 100),
        externalProductId: String(product.id),
        externalVariantId: String(variant.id),
        stockQty: variant.inventory_quantity ?? 0,
        listingMetadata: {
          inventory_item_id: variant.inventory_item_id,
          ...(locationId != null ? { location_id: locationId } : {}),
        },
      });
    }
  }

  return rows;
}

export async function pushShopifyStock(
  shop: string,
  accessToken: string,
  inventoryItemId: string,
  locationId: string,
  qty: number,
): Promise<void> {
  await shopifyFetch(shop, accessToken, "/inventory_levels/set.json", {
    method: "POST",
    body: JSON.stringify({
      location_id: Number(locationId),
      inventory_item_id: Number(inventoryItemId),
      available: qty,
    }),
  });
}
