import type { CatalogProductRow } from "@/integrations/shopify/catalog";
import { logIntegration, startTimer } from "@/shared/lib/logger";

const MARKETPLACE_ID = "A2Q3Y263D00KWC";
const SP_API_HOST = "https://sellingpartnerapi-na.amazon.com";

export async function pullAmazonProducts(
  _sellerId: string,
  accessToken: string,
): Promise<CatalogProductRow[]> {
  const end = startTimer();
  const rows: CatalogProductRow[] = [];

  try {
    const url = new URL(`${SP_API_HOST}/fba/inventory/v1/summaries`);
    url.searchParams.set("details", "true");
    url.searchParams.set("granularityType", "Marketplace");
    url.searchParams.set("granularityId", MARKETPLACE_ID);
    url.searchParams.set("marketplaceIds", MARKETPLACE_ID);

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-amz-access-token": accessToken,
      },
    });

    if (res.ok) {
      const body = (await res.json()) as {
        payload?: {
          inventorySummaries?: Array<{
            asin?: string;
            sellerSku?: string;
            productName?: string;
            totalQuantity?: number;
            inventoryDetails?: { fulfillableQuantity?: number };
          }>;
        };
      };

      for (const item of body.payload?.inventorySummaries ?? []) {
        const sku = item.sellerSku?.trim() || item.asin || "AMZ-UNKNOWN";
        rows.push({
          sku,
          name: item.productName ?? sku,
          priceCents: null,
          externalProductId: item.asin ?? sku,
          externalVariantId: sku,
          stockQty: item.inventoryDetails?.fulfillableQuantity ?? item.totalQuantity ?? 0,
        });
      }
    }
  } catch (err) {
    await logIntegration({
      provider: "amazon",
      operation: "pull_products",
      status: "error",
      duration_ms: end(),
      error_message: (err as Error).message,
    });
    return rows;
  }

  await logIntegration({
    provider: "amazon",
    operation: "pull_products",
    status: rows.length > 0 ? "success" : "error",
    duration_ms: end(),
    metadata: { count: rows.length },
  });

  return rows;
}

export async function pushAmazonStock(
  clientId: string,
  listingId: string,
  sku: string,
  qty: number,
  accessToken: string,
): Promise<void> {
  const end = Date.now();
  try {
    const res = await fetch(
      `${SP_API_HOST}/listings/2021-08-01/items/${encodeURIComponent(listingId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-amz-access-token": accessToken,
        },
        body: JSON.stringify({
          productType: "PRODUCT",
          patches: [
            {
              op: "replace",
              path: "/attributes/fulfillment_availability",
              value: [{ quantity: qty, fulfillment_channel_code: "DEFAULT" }],
            },
          ],
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Amazon stock push failed: ${res.status} ${text}`);
    }

    await logIntegration({
      client_id: clientId,
      provider: "amazon",
      operation: "push_stock",
      status: "success",
      duration_ms: Date.now() - end,
      metadata: { sku, qty },
    });
  } catch (err) {
    await logIntegration({
      client_id: clientId,
      provider: "amazon",
      operation: "push_stock",
      status: "error",
      duration_ms: Date.now() - end,
      error_message: (err as Error).message,
      metadata: { sku, qty },
    });
    throw err;
  }
}
