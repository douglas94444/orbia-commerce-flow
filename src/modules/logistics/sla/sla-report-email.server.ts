import { sendEmail } from "@/integrations/resend";
import { getServerConfig } from "@/lib/config.server";
import { buildSlaMonthlyReport } from "./sla-report.server";

export async function buildSlaMonthlyReportHtml(clientId: string, month?: string): Promise<string> {
  const report = await buildSlaMonthlyReport(clientId, month);
  const rows = (section: typeof report.byChannel) =>
    section
      .map(
        (r) =>
          `<tr><td>${r.dimensionValue}</td><td>${r.total}</td><td>${r.compliancePercent}%</td><td>${r.breached}</td></tr>`,
      )
      .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"/><title>SLA ${report.month}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;color:#111}
table{width:100%;border-collapse:collapse;margin:1rem 0}td,th{border:1px solid #ddd;padding:8px;font-size:14px}
th{background:#f5f5f5}</style></head><body>
<h1>Relatório SLA — ${report.month}</h1>
<h2>Por canal</h2><table><tr><th>Canal</th><th>Pedidos</th><th>Compliance</th><th>Estouros</th></tr>${rows(report.byChannel)}</table>
<h2>Por transportadora</h2><table><tr><th>Transportadora</th><th>Pedidos</th><th>Compliance</th><th>Estouros</th></tr>${rows(report.byCarrier)}</table>
<h2>Por região</h2><table><tr><th>Região</th><th>Pedidos</th><th>Compliance</th><th>Estouros</th></tr>${rows(report.byRegion)}</table>
<p style="font-size:12px;color:#666">Orbia Fulfillly — imprima como PDF no navegador se necessário</p>
</body></html>`;
}

export async function sendSlaMonthlyReportEmail(
  clientId: string,
  toEmail: string,
  month?: string,
): Promise<{ sent: boolean }> {
  const { resend } = getServerConfig();
  if (!resend.apiKey) return { sent: false };

  const html = await buildSlaMonthlyReportHtml(clientId, month);
  const label = month ?? new Date().toISOString().slice(0, 7);

  await sendEmail({
    to: toEmail,
    subject: `Relatório SLA Fulfillly — ${label}`,
    html,
    clientId,
  });

  return { sent: true };
}
