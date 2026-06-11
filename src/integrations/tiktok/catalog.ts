import { logIntegration } from "@/shared/lib/logger";

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
