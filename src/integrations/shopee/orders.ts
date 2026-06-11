import { logIntegration, startTimer } from "@/shared/lib/logger";

export async function updateShopeeOrderStatus(
  orderSn: string,
  status: string,
  accessToken: string,
): Promise<void> {
  const end = startTimer();
  const res = await fetch("https://partner.shopeemobile.com/api/v2/order/update_shipment", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order_sn: orderSn, status }),
  });

  await logIntegration({
    provider: "shopee",
    operation: "update_order_status",
    status: res.ok ? "success" : "error",
    response_code: res.status,
    duration_ms: end(),
    metadata: { orderSn, status },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopee order update failed: ${text.slice(0, 200)}`);
  }
}
