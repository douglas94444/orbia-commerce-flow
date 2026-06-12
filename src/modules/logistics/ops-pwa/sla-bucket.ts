export type SlaBucket = "critical" | "at_risk" | "on_time" | "none";

export function getSlaBucket(deadlineAt: string | null | undefined): SlaBucket {
  if (!deadlineAt) return "none";
  const deadline = new Date(deadlineAt).getTime();
  const now = Date.now();
  const hoursLeft = (deadline - now) / (60 * 60 * 1000);

  if (hoursLeft <= 0) return "critical";
  if (hoursLeft <= 2) return "critical";
  if (hoursLeft <= 6) return "at_risk";
  return "on_time";
}

export const SLA_BUCKET_LABEL: Record<SlaBucket, string> = {
  critical: "Crítico",
  at_risk: "Em risco",
  on_time: "No prazo",
  none: "—",
};

export const SLA_BUCKET_CLASS: Record<SlaBucket, string> = {
  critical: "text-destructive",
  at_risk: "text-warning",
  on_time: "text-success",
  none: "text-muted-foreground",
};
