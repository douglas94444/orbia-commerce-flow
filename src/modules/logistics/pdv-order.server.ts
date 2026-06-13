import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/shared/lib/logger";
import { triggerNfeForOrder } from "./order-ingestion.server";

export interface CreatePdvOrderInput {
  clientId: string;
  valueCents: number;
  items: Array<{ sku: string; name: string; quantity: number; unitPriceCents: number }>;
  customerName?: string;
  customerCpf?: string;
}

/** Stub PDV/balcão — cria pedido com canal pdv e dispara NFC-e. */
export async function createPdvOrder(input: CreatePdvOrderInput): Promise<string> {
  const externalId = `PDV-${Date.now()}`;

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .insert({
      client_id: input.clientId,
      external_id: externalId,
      channel: "pdv",
      status: "aguardando_nf",
      nf_status: "pendente",
      value_cents: input.valueCents,
      metadata: {
        emit_nfce: true,
        items: input.items,
        shipping: {
          name: input.customerName ?? "Consumidor",
          cpf: input.customerCpf,
        },
      },
    })
    .select("id")
    .single();

  if (error || !order) throw new Error(error?.message ?? "Falha ao criar pedido PDV");

  await logAudit({
    client_id: input.clientId,
    action: "create",
    resource: "order",
    resource_id: order.id,
    new_data: { channel: "pdv", external_id: externalId },
  });

  await triggerNfeForOrder(order.id);
  return order.id;
}
