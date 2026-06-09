import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { refreshClientLastContact } from "./admin.server";

/** Notifica CS quando pedido é entregue — cria nota de onboarding e alerta se SLA longo. */
export async function notifyCsOnOrderDelivered(
  orderId: string,
  clientId: string,
): Promise<void> {
  const { data: staff } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("role", ["orbia_admin", "orbia_staff"])
    .limit(1)
    .maybeSingle();

  if (staff?.id) {
    await supabaseAdmin.from("cs_activities").insert({
      client_id: clientId,
      staff_id: staff.id,
      kind: "onboarding_note",
      notes: `Pedido ${orderId.slice(0, 8)} entregue — acompanhar satisfação pós-entrega.`,
      metadata: { order_id: orderId, auto: true },
    });
    await refreshClientLastContact(clientId);
  }

  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("name, last_contact_days")
    .eq("id", clientId)
    .single();

  if ((client?.last_contact_days ?? 0) > 14) {
    await supabaseAdmin.from("operation_alerts").insert({
      client_id: clientId,
      kind: "health",
      severity: "warning",
      title: "Cliente sem contato após entrega",
      message: `${client?.name ?? "Cliente"} entregou pedido mas está há ${client?.last_contact_days}d sem contato CS.`,
      is_resolved: false,
    });
  }
}
