import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { CatalogChannel } from "./sync-catalog.server";

export interface ChannelStockBuffer {
  bufferPct: number;
  blackoutWhenZero: boolean;
}

export async function getChannelStockBuffer(
  clientId: string,
  channel: CatalogChannel,
): Promise<ChannelStockBuffer> {
  const { data } = await supabaseAdmin
    .from("channel_stock_buffers")
    .select("buffer_pct, blackout_when_zero")
    .eq("client_id", clientId)
    .eq("channel", channel)
    .maybeSingle();

  return {
    bufferPct: data?.buffer_pct != null ? Number(data.buffer_pct) : 0,
    blackoutWhenZero: data?.blackout_when_zero ?? true,
  };
}

export function applyStockBuffer(availableQty: number, buffer: ChannelStockBuffer): number {
  if (availableQty <= 0) {
    return buffer.blackoutWhenZero ? 0 : availableQty;
  }

  const buffered = Math.floor(availableQty * (1 - buffer.bufferPct / 100));
  return Math.max(0, buffered);
}

export async function getBufferedStockForChannel(
  clientId: string,
  channel: CatalogChannel,
  availableQty: number,
): Promise<number> {
  const buffer = await getChannelStockBuffer(clientId, channel);
  return applyStockBuffer(availableQty, buffer);
}
