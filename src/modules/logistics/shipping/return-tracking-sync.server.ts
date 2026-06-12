import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCarrierProvider } from "@/integrations/carriers";
import { getCarrierToken } from "./routing-engine.server";
import { normalizeCarrierStatus } from "./tracking-transition.server";
import { scheduleReturnReceiving } from "../returns/returns.server";

const BATCH = 50;

export async function syncAllReturnTracking(): Promise<{
  synced: number;
  received: number;
}> {
  let synced = 0;
  let received = 0;
  let offset = 0;

  while (true) {
    const { data: returns } = await supabaseAdmin
      .from("return_requests")
      .select("id, client_id, metadata, tracking_code")
      .eq("status", "in_transit")
      .not("tracking_code", "is", null)
      .range(offset, offset + BATCH - 1);

    if (!returns?.length) break;

    for (const ret of returns) {
      const meta = (ret.metadata ?? {}) as Record<string, unknown>;
      const shipmentId = meta.shipment_external_id as string | undefined;
      const providerId = (meta.carrier_provider_id as string | undefined) ?? "melhor_envio";
      if (!shipmentId) continue;

      const provider = getCarrierProvider(providerId);
      const token = await getCarrierToken(ret.client_id as string, providerId);
      if (!provider || !token) continue;

      try {
        const tracking = await provider.getTracking(shipmentId, token);
        synced += 1;
        const normalized = normalizeCarrierStatus(tracking.status);

        if (normalized.orderStatus === "entregue") {
          await scheduleReturnReceiving(ret.id as string);
          received += 1;
        }
      } catch (err) {
        console.error(`[sync-return-tracking] ${ret.id}:`, err);
      }
    }

    if (returns.length < BATCH) break;
    offset += BATCH;
  }

  return { synced, received };
}
