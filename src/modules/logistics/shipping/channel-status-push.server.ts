import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptToken } from "@/lib/crypto.server";
import { logIntegration } from "@/shared/lib/logger";
import { shopifyFetch } from "@/integrations/shopify/client";
import { nuvemshopFetch } from "@/integrations/nuvemshop/client";

export async function pushOrderInTransitToChannel(
  clientId: string,
  channel: string,
  externalOrderId: string,
  trackingCode?: string,
): Promise<void> {
  const providerKey =
    channel === "mercado_livre" ? "mercado_livre" : channel === "nuvemshop" ? "nuvemshop" : channel;

  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account")
    .eq("client_id", clientId)
    .eq("provider", providerKey)
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) return;

  const token = decryptToken(conn.access_token);

  try {
    if (channel === "mercado_livre") {
      await fetch(`https://api.mercadolibre.com/orders/${externalOrderId}/shipments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_transit", tracking_number: trackingCode ?? undefined }),
      });
    } else if (channel === "shopee") {
      const { updateShopeeOrderStatus } = await import("@/integrations/shopee/orders");
      await updateShopeeOrderStatus(externalOrderId, "IN_TRANSIT", token);
    } else if (channel === "amazon") {
      const { updateAmazonShipmentStatus } = await import("@/integrations/amazon/orders");
      await updateAmazonShipmentStatus(externalOrderId, "InTransit", token);
    } else if (channel === "tiktok") {
      const { updateTiktokShipmentStatus } = await import("@/integrations/tiktok/orders");
      await updateTiktokShipmentStatus(externalOrderId, "IN_TRANSIT", token);
    } else if (channel === "shopify" && trackingCode) {
      const shop = conn.external_account as string;
      await shopifyFetch(shop, token, `/orders/${externalOrderId}/fulfillments.json`, {
        method: "POST",
        body: JSON.stringify({
          fulfillment: { tracking_number: trackingCode, notify_customer: true },
        }),
      });
    } else if (channel === "nuvemshop") {
      const storeId = conn.external_account as string;
      await nuvemshopFetch(storeId, token, `/orders/${externalOrderId}`, {
        method: "PUT",
        body: JSON.stringify({
          shipping_status: "in_transit",
          shipping_tracking_number: trackingCode ?? null,
        }),
      });
    } else if (channel === "instagram") {
      const { pushInstagramShipmentStatus } = await import("@/integrations/instagram/fulfillment");
      await pushInstagramShipmentStatus(
        clientId,
        token,
        externalOrderId,
        "in_transit",
        trackingCode,
      );
    }

    await logIntegration({
      client_id: clientId,
      provider: channel,
      operation: "push_status_in_transit",
      status: "success",
      metadata: { externalOrderId, trackingCode },
    });
  } catch (err) {
    await logIntegration({
      client_id: clientId,
      provider: channel,
      operation: "push_status_in_transit",
      status: "error",
      error_message: (err as Error).message,
    });
  }
}

export async function pushOrderStatusToChannel(
  clientId: string,
  channel: string,
  externalOrderId: string,
  status: "shipped" | "delivered" | "cancelled",
  trackingCode?: string,
): Promise<void> {
  const providerKey =
    channel === "mercado_livre" ? "mercado_livre" : channel === "nuvemshop" ? "nuvemshop" : channel;

  const { data: conn } = await supabaseAdmin
    .from("oauth_connections")
    .select("access_token, external_account")
    .eq("client_id", clientId)
    .eq("provider", providerKey)
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) return;

  const token = decryptToken(conn.access_token);

  try {
    if (channel === "mercado_livre" && status === "shipped") {
      await fetch(`https://api.mercadolibre.com/orders/${externalOrderId}/shipments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "shipped",
          tracking_number: trackingCode ?? undefined,
        }),
      });
    } else if (channel === "mercado_livre" && status === "delivered") {
      await fetch(`https://api.mercadolibre.com/orders/${externalOrderId}/shipments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "delivered" }),
      });
    } else if (channel === "shopee" && status === "shipped") {
      const { updateShopeeOrderStatus } = await import("@/integrations/shopee/orders");
      await updateShopeeOrderStatus(externalOrderId, "SHIPPED", token);
    } else if (channel === "shopee" && status === "delivered") {
      const { updateShopeeOrderStatus } = await import("@/integrations/shopee/orders");
      await updateShopeeOrderStatus(externalOrderId, "COMPLETED", token);
    } else if (channel === "amazon" && status === "shipped") {
      const { updateAmazonShipmentStatus } = await import("@/integrations/amazon/orders");
      await updateAmazonShipmentStatus(externalOrderId, "Shipped", token);
    } else if (channel === "amazon" && status === "delivered") {
      const { updateAmazonShipmentStatus } = await import("@/integrations/amazon/orders");
      await updateAmazonShipmentStatus(externalOrderId, "Delivered", token);
    } else if (channel === "tiktok" && status === "shipped") {
      const { updateTiktokShipmentStatus } = await import("@/integrations/tiktok/orders");
      await updateTiktokShipmentStatus(externalOrderId, "IN_TRANSIT", token);
    } else if (channel === "tiktok" && status === "delivered") {
      const { updateTiktokShipmentStatus } = await import("@/integrations/tiktok/orders");
      await updateTiktokShipmentStatus(externalOrderId, "DELIVERED", token);
    } else if (channel === "shopify" && status === "shipped" && trackingCode) {
      const shop = conn.external_account as string;
      await shopifyFetch(shop, token, `/orders/${externalOrderId}/fulfillments.json`, {
        method: "POST",
        body: JSON.stringify({
          fulfillment: {
            tracking_number: trackingCode,
            notify_customer: true,
          },
        }),
      });
    } else if (channel === "shopify" && status === "delivered") {
      const shop = conn.external_account as string;
      await shopifyFetch(shop, token, `/orders/${externalOrderId}/fulfillments.json`, {
        method: "POST",
        body: JSON.stringify({
          fulfillment: {
            tracking_number: trackingCode ?? undefined,
            notify_customer: true,
            status: "success",
          },
        }),
      });
    } else if (channel === "nuvemshop" && status === "shipped") {
      const storeId = conn.external_account as string;
      await nuvemshopFetch(storeId, token, `/orders/${externalOrderId}`, {
        method: "PUT",
        body: JSON.stringify({
          shipping_status: "shipped",
          shipping_tracking_number: trackingCode ?? null,
        }),
      });
    } else if (channel === "nuvemshop" && status === "delivered") {
      const storeId = conn.external_account as string;
      await nuvemshopFetch(storeId, token, `/orders/${externalOrderId}`, {
        method: "PUT",
        body: JSON.stringify({
          shipping_status: "delivered",
          shipping_tracking_number: trackingCode ?? null,
        }),
      });
    } else if (channel === "instagram") {
      const { pushInstagramShipmentStatus } = await import("@/integrations/instagram/fulfillment");
      const igStatus =
        status === "delivered" ? "delivered" : status === "shipped" ? "shipped" : "in_transit";
      await pushInstagramShipmentStatus(
        clientId,
        token,
        externalOrderId,
        igStatus,
        trackingCode,
      );
    }

    await logIntegration({
      client_id: clientId,
      provider: channel,
      operation: `push_status_${status}`,
      status: "success",
      metadata: { externalOrderId, trackingCode },
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
