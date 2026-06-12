import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCarrierProvider } from "@/integrations/carriers";
import { logAudit } from "@/shared/lib/logger";
import { getCarrierToken, selectBestCarrier } from "./routing-engine.server";
import { computeOrderShipmentSpecs } from "./shipment-specs.server";

export async function purchasePackingLabel(
  orderId: string,
  userId?: string,
): Promise<{ trackingCode: string; labelUrl?: string }> {
  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, status, nf_status, metadata, tracking_code")
    .eq("id", orderId)
    .single();

  if (error || !order) throw new Error(`Pedido ${orderId} não encontrado`);

  const meta = (order.metadata ?? {}) as Record<string, unknown>;
  const existingLabel = meta.label_url as string | undefined;
  const existingTracking = order.tracking_code as string | null;
  if (existingLabel && existingTracking) {
    return { trackingCode: existingTracking, labelUrl: existingLabel };
  }

  if (order.nf_status !== "autorizada") {
    throw new Error("NF-e deve estar autorizada antes de gerar etiqueta");
  }
  if (order.status !== "em_packing") {
    throw new Error(`Pedido em status "${order.status}" — esperado em_packing`);
  }

  const specs = await computeOrderShipmentSpecs(orderId);
  const postal = String(meta.postal_code ?? "01310100");
  const quote = await selectBestCarrier(order.client_id as string, {
    toPostalCode: postal,
    weightKg: specs.weightKg,
    lengthCm: specs.lengthCm,
    widthCm: specs.widthCm,
    heightCm: specs.heightCm,
  });

  if (!quote) throw new Error("Nenhuma transportadora disponível para este CEP");

  const provider = getCarrierProvider(quote.providerId);
  if (!provider) throw new Error(`Provider ${quote.providerId} não configurado`);

  const token = await getCarrierToken(order.client_id as string, quote.providerId);
  if (!token) throw new Error(`Token OAuth ausente para ${quote.providerName}`);

  const label = await provider.purchaseLabel(quote.externalId, token);

  const nextMetadata: Record<string, unknown> = {
    ...meta,
    carrier_provider_id: quote.providerId,
    shipping_cost_cents: quote.priceCents,
    label_url: label.labelUrl ?? null,
    packing_label_generated_at: new Date().toISOString(),
  };

  await supabaseAdmin
    .from("orders")
    .update({
      carrier: quote.providerName,
      tracking_code: label.trackingCode,
      shipment_external_id: label.shipmentId,
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  await supabaseAdmin.from("shipments").insert({
    client_id: order.client_id,
    order_id: orderId,
    provider: quote.providerId,
    tracking_code: label.trackingCode,
    shipment_external_id: label.shipmentId,
    label_url: label.labelUrl ?? null,
    status: "created",
  });

  if (userId) {
    await logAudit({
      user_id: userId,
      client_id: order.client_id as string,
      action: "update",
      resource: "order",
      resource_id: orderId,
      new_data: { packing_label: true, tracking_code: label.trackingCode },
    });
  }

  return { trackingCode: label.trackingCode, labelUrl: label.labelUrl };
}
