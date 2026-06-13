import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";
import { logIntegration, startTimer } from "@/shared/lib/logger";
import type { MarketplaceChannel } from "./order-ingestion.server";

export async function handleChannelCancellation(input: {
  clientId: string;
  channel: MarketplaceChannel;
  externalOrderId: string;
  reason?: string;
}): Promise<void> {
  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account, metadata")
    .eq("client_id", input.clientId)
    .eq("provider", input.channel)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (!conn?.access_token) return;

  const token = decryptToken(conn.access_token);
  const end = startTimer();

  try {
    switch (input.channel) {
      case "mercado_livre": {
        await fetch(`https://api.mercadolibre.com/orders/${input.externalOrderId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "cancelled" }),
        });
        break;
      }
      case "shopee": {
        const { updateShopeeOrderStatus } = await import("@/integrations/shopee/orders");
        await updateShopeeOrderStatus(input.externalOrderId, "CANCELLED", token);
        break;
      }
      case "nuvemshop": {
        const storeId = conn.external_account ?? "";
        await fetch(`https://api.tiendanube.com/v1/${storeId}/orders/${input.externalOrderId}`, {
          method: "PUT",
          headers: {
            Authorization: `bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "Orbia (orbia@performanc.com.br)",
          },
          body: JSON.stringify({ status: "cancelled" }),
        });
        break;
      }
      case "shopify": {
        const shop = String((conn.metadata as Record<string, unknown>)?.shop ?? conn.external_account);
        const host = shop.includes(".myshopify.com") ? shop : `${shop}.myshopify.com`;
        await fetch(`https://${host}/admin/api/2024-01/orders/${input.externalOrderId}/cancel.json`, {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: input.reason ?? "other" }),
        });
        break;
      }
      case "amazon":
        break;
      case "tiktok": {
        const { acknowledgeTiktokCancellation } = await import("@/integrations/tiktok/orders");
        await acknowledgeTiktokCancellation(
          input.externalOrderId,
          token,
          conn.external_account ?? "",
        );
        break;
      }
      default:
        break;
    }

    await logIntegration({
      client_id: input.clientId,
      provider: input.channel,
      operation: "cancel_order",
      status: "success",
      duration_ms: end(),
    });
  } catch (err) {
    await logIntegration({
      client_id: input.clientId,
      provider: input.channel,
      operation: "cancel_order",
      status: "error",
      duration_ms: end(),
      error_message: (err as Error).message,
    });
  }

  const { enqueueStockSync } = await import("@/modules/catalog/stock-sync-outbox.server");
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("channel", input.channel)
    .eq("external_id", input.externalOrderId)
    .maybeSingle();

  if (!order) return;

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("sku")
    .eq("order_id", order.id);

  for (const item of items ?? []) {
    await enqueueStockSync(
      input.clientId,
      item.sku as string,
      `cancel:${input.channel}:${input.externalOrderId}`,
    );
  }
}
