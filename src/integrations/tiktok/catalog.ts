import type { CatalogProductRow } from "@/integrations/shopify/catalog";
import { logIntegration, startTimer } from "@/shared/lib/logger";

interface TikTokProductSearchResponse {
  data?: {
    products?: Array<{
      id: string;
      title?: string;
      skus?: Array<{
        id: string;
        seller_sku?: string;
        price?: { sale_price?: string };
        stock_infos?: Array<{ available_stock?: number }>;
      }>;
    }>;
    next_page_token?: string;
  };
}

export async function pullTikTokProducts(
  shopId: string,
  accessToken: string,
): Promise<CatalogProductRow[]> {
  const end = startTimer();
  const rows: CatalogProductRow[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const res = await fetch(
        "https://open-api.tiktokglobalshop.com/product/202309/products/search",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "x-tts-access-token": accessToken,
          },
          body: JSON.stringify({
            shop_id: shopId,
            page_size: 50,
            ...(pageToken ? { page_token: pageToken } : {}),
          }),
        },
      );

      if (!res.ok) break;

      const body = (await res.json()) as TikTokProductSearchResponse;
      for (const product of body.data?.products ?? []) {
        const skus = product.skus?.length
          ? product.skus
          : [{ id: product.id, seller_sku: undefined, stock_infos: [{ available_stock: 0 }] }];

        for (const sku of skus) {
          const skuCode = sku.seller_sku?.trim() || `TT-${sku.id}`;
          rows.push({
            sku: skuCode,
            name: product.title ?? skuCode,
            priceCents: sku.price?.sale_price
              ? Math.round(Number(sku.price.sale_price) * 100)
              : null,
            externalProductId: product.id,
            externalVariantId: sku.id,
            stockQty: sku.stock_infos?.[0]?.available_stock ?? 0,
          });
        }
      }

      pageToken = body.data?.next_page_token;
    } while (pageToken && rows.length < 500);
  } catch (err) {
    await logIntegration({
      provider: "tiktok",
      operation: "pull_products",
      status: "error",
      duration_ms: end(),
      error_message: (err as Error).message,
    });
    return rows;
  }

  await logIntegration({
    provider: "tiktok",
    operation: "pull_products",
    status: rows.length > 0 ? "success" : "error",
    duration_ms: end(),
    metadata: { count: rows.length, shopId },
  });

  return rows;
}

export async function pushTikTokStock(
  clientId: string,
  productId: string,
  skuId: string,
  qty: number,
  accessToken: string,
  shopId: string,
): Promise<void> {
  const end = Date.now();
  try {
    const res = await fetch(
      "https://open-api.tiktokglobalshop.com/product/202309/products/stocks",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-tts-access-token": accessToken,
        },
        body: JSON.stringify({
          shop_id: shopId,
          product_id: productId,
          skus: [{ id: skuId, stock_infos: [{ available_stock: qty }] }],
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TikTok stock push failed: ${res.status} ${text}`);
    }

    await logIntegration({
      client_id: clientId,
      provider: "tiktok",
      operation: "push_stock",
      status: "success",
      duration_ms: Date.now() - end,
      metadata: { productId, qty },
    });
  } catch (err) {
    await logIntegration({
      client_id: clientId,
      provider: "tiktok",
      operation: "push_stock",
      status: "error",
      duration_ms: Date.now() - end,
      error_message: (err as Error).message,
      metadata: { productId, qty },
    });
    throw err;
  }
}
