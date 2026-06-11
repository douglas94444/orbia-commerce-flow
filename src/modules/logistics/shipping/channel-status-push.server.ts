import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";
import { logIntegration } from "@/shared/lib/logger";

export async function pushOrderStatusToChannel(
  clientId: string,
  channel: string,
  externalOrderId: string,
  status: "shipped" | "delivered" | "cancelled",
): Promise<void> {
  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account")
    .eq("client_id", clientId)
    .eq("provider", channel === "mercado_livre" ? "mercado_livre" : channel)
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) return;

  const token = decryptToken(conn.access_token);

  try {
    if (channel === "mercado_livre" && status === "shipped") {
      await fetch(`https://api.mercadolibre.com/orders/${externalOrderId}/shipments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "shipped" }),
      });
    } else if (channel === "shopee" && status === "shipped") {
      const { updateShopeeOrderStatus } = await import("@/integrations/shopee/orders");
      await updateShopeeOrderStatus(externalOrderId, "SHIPPED", token);
    } else if (channel === "amazon" && status === "shipped") {
      const { updateAmazonShipmentStatus } = await import("@/integrations/amazon/orders");
      await updateAmazonShipmentStatus(externalOrderId, "Shipped", token);
    } else if (channel === "tiktok" && status === "shipped") {
      const { updateTiktokShipmentStatus } = await import("@/integrations/tiktok/orders");
      await updateTiktokShipmentStatus(externalOrderId, "IN_TRANSIT", token);
    }

    await logIntegration({
      client_id: clientId,
      provider: channel,
      operation: `push_status_${status}`,
      status: "success",
      metadata: { externalOrderId },
    });
  } catch (err) {
    await logIntegration({
      client_id: clientId,
      provider: channel,
      operation: `push_status_${status}`,
      status: "error",
      error_message: (err as Error).message,
    });
  }
}
