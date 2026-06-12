import { logIntegration } from "@/shared/lib/logger";

const GRAPH_API = "https://graph.facebook.com/v21.0";

export async function pushInstagramShipmentStatus(
  clientId: string,
  accessToken: string,
  externalOrderId: string,
  status: "in_transit" | "shipped" | "delivered",
  trackingCode?: string,
): Promise<void> {
  const shipmentStatus =
    status === "delivered" ? "DELIVERED" : status === "in_transit" ? "IN_TRANSIT" : "SHIPPED";

  const res = await fetch(`${GRAPH_API}/${externalOrderId}/shipments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tracking_info: {
        tracking_number: trackingCode ?? undefined,
        shipping_carrier: "OTHER",
      },
      shipment_status: shipmentStatus,
    }),
  });

  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = (body.error as { message?: string })?.message ?? `HTTP ${res.status}`;
    throw new Error(err);
  }

  await logIntegration({
    client_id: clientId,
    provider: "instagram",
    operation: `push_status_${status}`,
    status: "success",
    metadata: { externalOrderId, trackingCode },
  });
}
