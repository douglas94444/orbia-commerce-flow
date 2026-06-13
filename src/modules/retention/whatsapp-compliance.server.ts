import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashContact } from "./customer-sync.server";
import { cancelEnrollmentsForCustomer } from "./enrollment.server";
import { routeInboundMessage } from "@/modules/sac/routing/sac-router.server";

const OPT_OUT_KEYWORDS = ["parar", "stop", "cancelar", "sair"];
const OPT_IN_KEYWORDS = ["sim", "aceito", "quero", "ok", "confirmo"];

export async function handleInboundWhatsApp(input: {
  clientId: string;
  from: string;
  text: string;
  replyId?: string;
  replyType?: "button_reply" | "list_reply" | "text";
}): Promise<void> {
  const normalized = input.text.trim().toLowerCase();
  const phoneHash = hashContact(input.from);

  const windowExpires = new Date(Date.now() + 24 * 60 * 60_000);

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("client_id", input.clientId)
    .eq("phone_hash", phoneHash)
    .maybeSingle();

  if (customer) {
    await supabaseAdmin.from("customer_contact_prefs").upsert(
      {
        customer_id: customer.id,
        whatsapp_window_expires_at: windowExpires.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id" },
    );
  }

  if (OPT_IN_KEYWORDS.includes(normalized) && customer) {
    await supabaseAdmin.from("customer_contact_prefs").upsert(
      {
        customer_id: customer.id,
        marketing_opt_in: true,
        marketing_opt_in_at: new Date().toISOString(),
        contact_phone: input.from,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id" },
    );
    return;
  }

  if (OPT_OUT_KEYWORDS.includes(normalized)) {
    await supabaseAdmin.from("whatsapp_opt_outs").upsert(
      {
        client_id: input.clientId,
        phone_hash: phoneHash,
        opted_out_at: new Date().toISOString(),
        source: "keyword_parar",
      },
      { onConflict: "client_id,phone_hash" },
    );

    if (customer) {
      const { data: prefs } = await supabaseAdmin
        .from("customer_contact_prefs")
        .select("opted_out_channels")
        .eq("customer_id", customer.id)
        .maybeSingle();

      const channels = new Set([...(prefs?.opted_out_channels ?? []), "whatsapp", "sms"]);
      await supabaseAdmin
        .from("customer_contact_prefs")
        .upsert(
          {
            customer_id: customer.id,
            opted_out_channels: Array.from(channels),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "customer_id" },
        );

      await cancelEnrollmentsForCustomer(customer.id, "opt_out_parar");
    }
    return;
  }

  const isInteractive =
    input.replyId &&
    (input.replyType === "button_reply" || input.replyType === "list_reply");

  if (input.replyId === "ver_pedido" && customer) {
    await routeInboundMessage({
      clientId: input.clientId,
      channel: "whatsapp",
      text: "onde está meu pedido",
      fromPhone: input.from,
      customerId: customer.id,
      replyId: input.replyId,
    });
    return;
  }

  await routeInboundMessage({
    clientId: input.clientId,
    channel: "whatsapp",
    text: input.text || input.replyId || "",
    fromPhone: input.from,
    customerId: customer?.id ?? null,
    replyId: isInteractive ? input.replyId : undefined,
    forceHuman: input.replyId === "falar_atendimento",
  });
}

export async function handleInboundEvolution(input: {
  clientId: string;
  from: string;
  text: string;
}): Promise<void> {
  await handleInboundWhatsApp(input);
}

export async function listWhatsAppTemplates(clientId: string) {
  const { data, error } = await supabaseAdmin
    .from("whatsapp_templates")
    .select("id, name, language, status, category, created_at")
    .eq("client_id", clientId)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}
