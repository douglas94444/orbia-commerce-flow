import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/integrations/resend/client";
import { extractShippingFromMetadata } from "./nfe-destinatario.server";

export async function sendBuyerNfeEmail(orderId: string, danfeUrl: string | null): Promise<void> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, external_id, metadata")
    .eq("id", orderId)
    .single();

  if (!order) return;

  const metadata = (order.metadata ?? {}) as Record<string, unknown>;
  const shipping = extractShippingFromMetadata(metadata);
  const email = shipping.email;
  if (!email) return;

  const { data: emission } = await supabaseAdmin
    .from("nfe_emissions")
    .select("type, access_key, xml_url, danfe_url")
    .eq("order_id", orderId)
    .eq("status", "autorizada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const docUrl = danfeUrl ?? emission?.danfe_url ?? emission?.xml_url ?? null;
  const label = emission?.type === "NFS-e" ? "NFS-e" : emission?.type === "NFC-e" ? "NFC-e" : "NF-e";

  const linkBlock = docUrl
    ? `<p><a href="${docUrl}">Baixar ${label}</a></p>`
    : "<p>Seu documento fiscal foi emitido. Em breve enviaremos o link do PDF.</p>";

  await sendEmail({
    to: email,
    subject: `Sua ${label} — pedido ${order.external_id}`,
    html: `
      <p>Olá${shipping.name ? ` ${shipping.name}` : ""},</p>
      <p>A nota fiscal do seu pedido <strong>${order.external_id}</strong> foi autorizada.</p>
      ${emission?.access_key ? `<p>Chave: <code>${emission.access_key}</code></p>` : ""}
      ${linkBlock}
      <p>Equipe Orbia</p>
    `,
  });
}
