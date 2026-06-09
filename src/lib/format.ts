export function formatBRL(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000) {
    const sign = value < 0 ? "-" : "";
    const abs = Math.abs(value);
    if (abs >= 1_000_000) {
      const mi = (abs / 1_000_000).toFixed(1).replace(".", ",");
      return `${sign}R$ ${mi} mi`;
    }
    const mil = Math.round(abs / 1000);
    return `${sign}R$ ${mil} mil`;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}
