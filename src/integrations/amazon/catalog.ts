import { logIntegration } from "@/shared/lib/logger";

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
      `https://sellingpartnerapi-na.amazon.com/listings/2021-08-01/items/${encodeURIComponent(listingId)}`,
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
