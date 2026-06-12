export function buildTrackingUrl(trackingCode: string, carrier?: string | null): string {
  const code = trackingCode.trim();
  if (!code) return "";

  const c = (carrier ?? "").toLowerCase();
  if (c.includes("correios") || /^[A-Z]{2}\d{9}BR$/i.test(code)) {
    return `https://rastreamento.correios.com.br/app/index.php?objeto=${encodeURIComponent(code)}`;
  }
  if (c.includes("jadlog")) {
    return `https://www.jadlog.com.br/siteInstitucional/tracking.jad?cte=${encodeURIComponent(code)}`;
  }

  return `https://melhorrastreio.com.br/${encodeURIComponent(code)}`;
}
