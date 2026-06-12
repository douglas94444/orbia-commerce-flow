import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { RealMarginSummary } from "./margin-cogs.server";

function fmtBrl(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2)}`;
}

async function createPdfWithLines(
  title: string,
  subtitle: string,
  rows: Array<[string, string]>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  page.drawText(title, { x: 50, y, size: 18, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 24;
  page.drawText(subtitle, { x: 50, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 32;

  for (const [label, value] of rows) {
    page.drawText(label, { x: 50, y, size: 11, font: bold });
    page.drawText(value, { x: 280, y, size: 11, font });
    y -= 20;
    if (y < 60) break;
  }

  page.drawText("Orbia Commerce Flow — Fulfillly", {
    x: 50,
    y: 40,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return doc.save();
}

export async function buildMonthlyReportPdf(clientId: string): Promise<Uint8Array> {
  const { buildMonthlyReportHtml } = await import("./monthly-report.server");
  const { computeRealMargin } = await import("./margin-cogs.server");
  const html = await buildMonthlyReportHtml(clientId);
  const margin = await computeRealMargin(clientId);

  const month = new Date().toISOString().slice(0, 7);
  const titleMatch = html.match(/<h1>([^<]+)<\/h1>/);
  const title = titleMatch?.[1] ?? `Relatório mensal — ${month}`;

  return createPdfWithLines(title, `Período ${month}`, [
    ["GMV (30d)", fmtBrl(margin.gmvCents)],
    ["Investimento em mídia", fmtBrl(margin.adSpendCents)],
    ["COGS catálogo", fmtBrl(margin.cogsCents)],
    ["Custo fulfillment", fmtBrl(margin.fulfillmentCostCents)],
    ["Margem líquida", fmtBrl(margin.marginCents)],
    ["Margem %", `${margin.marginPercent}%`],
  ]);
}

export async function buildQbrReportPdf(clientId: string): Promise<Uint8Array> {
  const { buildClientQbrReport } = await import(
    "@/modules/logistics/analytics/client-qbr-report.server"
  );
  const report = await buildClientQbrReport(clientId);
  const month = new Date().toISOString().slice(0, 7);

  return createPdfWithLines(`QBR Fulfillly — ${month}`, "Deck executivo multi-módulo", [
    ["SLA cumprimento", `${report.logistics.sla.compliancePercent}%`],
    ["Acurácia picking", `${report.logistics.analytics.pickingAccuracyPercent}%`],
    ["Taxa incidentes", `${report.logistics.analytics.incidentRatePercent}%`],
    ["ROAS médio", `${report.traffic.avgRoas}x`],
    ["Investimento tráfego", fmtBrl(report.traffic.totalSpendCents)],
    ["Fluxos retenção ativos", String(report.retention.activeFlows)],
    ["MRR", fmtBrl(report.billing.mrrCents)],
    ["NF-e autorizadas 30d", String(report.fiscal.nfeAuthorized30d)],
  ]);
}

export function pdfToBase64(pdf: Uint8Array): string {
  return Buffer.from(pdf).toString("base64");
}

export type { RealMarginSummary };
