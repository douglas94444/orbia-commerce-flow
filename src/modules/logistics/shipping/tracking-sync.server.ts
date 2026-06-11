import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emitDomainEvent } from "@/shared/lib/domain-events.server";
import { syncTracking as syncMelhorEnvioTracking } from "../shipping.server";
import { pushOrderStatusToChannel } from "./channel-status-push.server";
import { sendTrackingWhatsApp } from "../notifications/whatsapp-alerts.server";

const PROBLEM_STATUSES = new Set([
  "undelivered",
  "failed",
  "returned",
  "address_not_found",
  "recipient_absent",
]);

export async function syncAllTracking(): Promise<{ synced: number; problems: number }> {
  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, channel, external_id, status, tracking_code, shipment_external_id, metadata")
    .in("status", ["despachado", "em_transito"])
    .not("shipment_external_id", "is", null)
    .limit(100);

  let synced = 0;
  let problems = 0;

  for (const order of orders ?? []) {
    try {
      const prevStatus = order.status as string;
      await syncMelhorEnvioTracking(order.id as string);

      const { data: updated } = await supabaseAdmin
        .from("orders")
        .select("status, tracking_code, metadata")
        .eq("id", order.id)
        .single();

      if (!updated) continue;
      synced += 1;

      const customerPhone = (updated.metadata as Record<string, unknown>)?.customer_phone as
        | string
        | undefined;

      if (updated.status === "em_transito" && prevStatus === "despachado" && customerPhone) {
        await sendTrackingWhatsApp(
          order.client_id as string,
          customerPhone,
          "out_for_delivery",
          updated.tracking_code as string,
          order.external_id as string,
        );
      }

      if (updated.status === "entregue") {
        await emitDomainEvent("order.delivered", {
          orderId: order.id,
          clientId: order.client_id,
        });
        if (customerPhone) {
          await sendTrackingWhatsApp(
            order.client_id as string,
            customerPhone,
            "delivered",
            updated.tracking_code as string,
            order.external_id as string,
          );
        }
        await pushOrderStatusToChannel(
          order.client_id as string,
          order.channel as string,
          order.external_id as string,
          "delivered",
        );
      }

      const carrierStatus = (updated.metadata as Record<string, unknown>)?.carrier_status as
        | string
        | undefined;
      if (carrierStatus && PROBLEM_STATUSES.has(carrierStatus.toLowerCase())) {
        await supabaseAdmin.from("delivery_incidents").insert({
          order_id: order.id,
          incident_type: carrierStatus,
          description: `Problema de entrega detectado: ${carrierStatus}`,
        });
        await emitDomainEvent("order.delivery_problem", {
          orderId: order.id,
          clientId: order.client_id,
          incidentType: carrierStatus,
        });
        problems += 1;
      }
    } catch (err) {
      console.error(`[sync-tracking] order ${order.id}:`, err);
    }
  }

  return { synced, problems };
}
