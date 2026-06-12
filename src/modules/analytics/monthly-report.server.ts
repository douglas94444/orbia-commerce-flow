import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail } from "@/integrations/resend";
import { getServerConfig } from "@/lib/config.server";
import { logJob } from "@/shared/lib/logger";

export async function buildMonthlyReportHtml(clientId: string): Promise<string> {
  const month = new Date().toISOString().slice(0, 7);
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("name, health_score, gmv_30d, roas_avg")
    .eq("id", clientId)
    .single();

  const { getClientLogisticsSnapshot } = await import("./logistics-snapshot.server");
  const logistics = await getClientLogisticsSnapshot(clientId);

  const gmv = ((client?.gmv_30d as number) ?? 0) / 100;
  const roas = Number(client?.roas_avg ?? 0);
  const health = client?.health_score ?? 0;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório Orbia — ${client?.name ?? clientId} — ${month}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; color: #111; }
    h1 { font-size: 1.5rem; } h2 { font-size: 1rem; margin-top: 1.5rem; color: #444; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; }
    td, th { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; }
    th { background: #f5f5f5; }
    .metric { font-size: 2rem; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Relatório mensal — ${client?.name ?? "Cliente"}</h1>
  <p>Período: ${month} · Gerado em ${new Date().toLocaleString("pt-BR")}</p>
  <h2>Performance comercial</h2>
  <p class="metric">Health ${health}</p>
  <table>
    <tr><th>GMV 30d</th><td>R$ ${gmv.toFixed(2)}</td></tr>
    <tr><th>ROAS médio</th><td>${roas}x</td></tr>
  </table>
  <h2>Logística Fulfillly</h2>
  <table>
    <tr><th>SLA cumprimento</th><td>${logistics.slaCompliancePercent}%</td></tr>
    <tr><th>Acurácia picking</th><td>${logistics.pickingAccuracyPercent}%</td></tr>
    <tr><th>Taxa incidentes</th><td>${logistics.incidentRatePercent}%</td></tr>
    <tr><th>Pedidos fulfillment (mês)</th><td>${logistics.fulfillmentOrdersMonth}</td></tr>
  </table>
  <p style="margin-top:2rem;font-size:12px;color:#666">Orbia Commerce Flow — relatório automatizado</p>
</body>
</html>`;
}

export async function sendMonthlyReportEmail(
  clientId: string,
  toEmail: string,
): Promise<{ sent: boolean }> {
  const html = await buildMonthlyReportHtml(clientId);
  const month = new Date().toISOString().slice(0, 7);
  const { data: client } = await supabaseAdmin
    .from("clients")
    .select("name")
    .eq("id", clientId)
    .single();

  const { resend } = getServerConfig();
  if (!resend.apiKey) return { sent: false };

  await sendEmail({
    to: toEmail,
    subject: `Relatório mensal Orbia — ${client?.name ?? "Cliente"} — ${month}`,
    html: `${html}<p style="margin-top:1rem;font-size:12px;color:#666">Para salvar como PDF: Arquivo → Imprimir → Salvar como PDF</p>`,
    clientId,
  });

  return { sent: true };
}

async function resolveCsEmails(): Promise<string[]> {
  const { data: staff } = await supabaseAdmin
    .from("client_members")
    .select("user_id")
    .in("role", ["orbia_admin", "orbia_staff"])
    .eq("status", "active")
    .limit(20);

  const emails: string[] = [];
  for (const s of staff ?? []) {
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(s.user_id as string);
    if (user.user?.email) emails.push(user.user.email);
  }
  return [...new Set(emails)];
}

export async function runMonthlyAnalyticsReportJob(): Promise<{ reports: number; emails: number }> {
  const end = Date.now();
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("status", "active");

  const csEmails = await resolveCsEmails();
  let reports = 0;
  let emails = 0;

  for (const c of clients ?? []) {
    await buildMonthlyReportHtml(c.id as string);
    reports += 1;

    for (const email of csEmails) {
      try {
        const result = await sendMonthlyReportEmail(c.id as string, email);
        if (result.sent) emails += 1;
      } catch {
        // continua para próximo destinatário
      }
    }
  }

  await logJob({
    job_type: "monthly-analytics-report",
    job_id: crypto.randomUUID(),
    status: "completed",
    duration_ms: Date.now() - end,
    metadata: { reports, emails },
  });

  return { reports, emails };
}
