import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashContact } from "./customer-sync.server";
import { cancelEnrollmentsForCustomer } from "./enrollment.server";

const OPT_OUT_KEYWORDS = ["parar", "stop", "cancelar", "sair"];
const OPT_IN_KEYWORDS = ["sim", "aceito", "quero", "ok", "confirmo"];

async function handleInteractiveReply(input: {
  clientId: string;
  customerId: string;
  from: string;
  replyId: string;
}): Promise<void> {
  const { sendWhatsAppMessage } = await import("@/integrations/whatsapp");
  const { getWhatsAppCredentials } = await import("@/integrations/whatsapp/provider");

  const creds = await getWhatsAppCredentials(input.clientId);
  if (!creds || creds.provider !== "meta") return;

  const { data: lastOrder } = await supabaseAdmin
    .from("orders")
    .select("id, status, tracking_code")
    .eq("client_id", input.clientId)
    .eq("customer_id", input.customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let reply = "Obrigado pelo contato! Em breve retornaremos.";
  if (input.replyId === "ver_pedido") {
    reply = lastOrder
      ? `Seu pedido ${lastOrder.id.slice(0, 8)} está ${lastOrder.status}.${lastOrder.tracking_code ? ` Rastreio: ${lastOrder.tracking_code}` : ""}`
      : "Não encontramos pedidos recentes para sua conta.";
  } else if (input.replyId === "falar_atendimento") {
    reply = "Um atendente entrará em contato em breve. Horário comercial: seg–sex 9h–18h.";
  } else if (input.replyId === "ver_produtos") {
    const { data: client } = await supabaseAdmin
      .from("clients")
      .select("name")
      .eq("id", input.clientId)
      .single();
    reply = `Confira as novidades da ${client?.name ?? "nossa loja"} em nosso site!`;
  }

  await sendWhatsAppMessage({
    phoneNumberId: creds.phoneNumberId,
    accessToken: creds.accessToken,
    to: input.from,
    body: reply,
    clientId: input.clientId,
  }).catch(() => undefined);
}

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

  if (
    customer &&
    input.replyId &&
    (input.replyType === "button_reply" || input.replyType === "list_reply")
  ) {
    await handleInteractiveReply({
      clientId: input.clientId,
      customerId: customer.id,
      replyId: input.replyId,
      from: input.from,
    });
    return;
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

  if (!OPT_OUT_KEYWORDS.includes(normalized)) return;

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
