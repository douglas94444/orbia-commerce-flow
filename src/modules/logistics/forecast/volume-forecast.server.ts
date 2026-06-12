import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWhatsAppToClient } from "../notifications/whatsapp-alerts.server";

export async function forecastVolumeFromCampaigns(): Promise<{ alerts: number }> {
  const in48h = new Date();
  in48h.setHours(in48h.getHours() + 48);
  const now = new Date();

  const { data: campaigns } = await supabaseAdmin
    .from("campaigns")
    .select("id, client_id, name, period_start, spend_cents")
    .gte("period_start", now.toISOString())
    .lte("period_start", in48h.toISOString())
    .eq("status", "active");

  let alerts = 0;

  for (const campaign of campaigns ?? []) {
    const expectedOrders = Math.max(10, Math.round((campaign.spend_cents as number) / 5000));

    const { data: existing } = await supabaseAdmin
      .from("volume_forecast_alerts")
      .select("id")
      .eq("client_id", campaign.client_id)
      .eq("campaign_ref", campaign.id)
      .maybeSingle();

    if (existing) continue;

    await supabaseAdmin.from("volume_forecast_alerts").insert({
      client_id: campaign.client_id,
      forecast_date: (campaign.period_start as string).slice(0, 10),
      expected_orders: expectedOrders,
      campaign_ref: campaign.id,
      notified_at: new Date().toISOString(),
    });

    await sendWhatsAppToClient(
      campaign.client_id as string,
      `Previsão de volume: campanha "${campaign.name}" pode gerar ~${expectedOrders} pedidos em 48h. Prepare o galpão.`,
    );
    alerts += 1;
  }

  return { alerts };
}

export async function recordFulfillmentUsage(
  clientId: string,
  field: "orders_processed" | "picks_completed" | "packs_completed" | "returns_handled",
): Promise<void> {
  const month = new Date();
  month.setDate(1);
  const periodMonth = month.toISOString().slice(0, 10);

  const { data: existing } = await supabaseAdmin
    .from("fulfillment_usage")
    .select("id, orders_processed, picks_completed, packs_completed, returns_handled")
    .eq("client_id", clientId)
    .eq("period_month", periodMonth)
    .maybeSingle();

  if (existing) {
    const row = existing as Record<string, number | string>;
    await supabaseAdmin
      .from("fulfillment_usage")
      .update({ [field]: (row[field] as number) + 1 })
      .eq("id", existing.id);
  } else {
    await supabaseAdmin.from("fulfillment_usage").insert({
      client_id: clientId,
      period_month: periodMonth,
      [field]: 1,
    });
  }

  if (field === "orders_processed") {
    const { checkFulfillmentQuotaAlerts } = await import(
      "@/modules/billing/fulfillment-billing.server"
    );
    await checkFulfillmentQuotaAlerts(clientId).catch(() => undefined);
  }
}
