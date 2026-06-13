import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { DiagnosisResult } from "./diagnosis-engine.server";

function fmtBrl(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

export async function buildDiagnosticPdf(
  companyName: string,
  contactName: string,
  monthlyRevenueCents: number,
  result: DiagnosisResult,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  page.drawText("Diagnóstico Orbia", { x: 50, y, size: 20, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 28;
  page.drawText(`${companyName} — ${contactName}`, { x: 50, y, size: 12, font });
  y -= 20;
  page.drawText(`Faturamento informado: ${fmtBrl(monthlyRevenueCents)}`, { x: 50, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 36;

  page.drawText(`Score geral: ${result.overallScore}/100`, { x: 50, y, size: 14, font: bold });
  y -= 22;
  page.drawText(`Potencial de crescimento: +${result.potentialGrowthPct}% em 90 dias`, { x: 50, y, size: 11, font });
  y -= 32;

  const wrap = (text: string, maxLen: number): string[] => {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      if ((line + w).length > maxLen) {
        lines.push(line.trim());
        line = w + " ";
      } else line += w + " ";
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  };

  for (const line of wrap(result.narrative, 80)) {
    page.drawText(line, { x: 50, y, size: 10, font });
    y -= 14;
  }
  y -= 16;

  page.drawText("Dimensões analisadas", { x: 50, y, size: 12, font: bold });
  y -= 20;
  for (const d of result.dimensions) {
    page.drawText(`${d.label}: ${d.score}/100`, { x: 50, y, size: 10, font: bold });
    y -= 14;
    page.drawText(d.impact.slice(0, 90), { x: 60, y, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
    y -= 18;
    if (y < 80) break;
  }

  if (result.gaps.length > 0 && y > 120) {
    y -= 10;
    page.drawText("Principais lacunas", { x: 50, y, size: 12, font: bold });
    y -= 18;
    for (const g of result.gaps.slice(0, 4)) {
      page.drawText(`• ${g.title}`, { x: 50, y, size: 10, font: bold });
      y -= 14;
      page.drawText(`  Solução Orbia: ${g.solution}`, { x: 50, y, size: 9, font });
      y -= 18;
    }
  }

  page.drawText("Orbia Commerce Flow — Diagnóstico gratuito", { x: 50, y: 40, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  return doc.save();
}

export function pdfToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
