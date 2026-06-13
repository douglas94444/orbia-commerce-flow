export const PLAN_PRICES_CENTS = {
  launch: 350_000,
  growth: 900_000,
  scale: 1_800_000,
} as const;

export const PLAN_LABELS: Record<keyof typeof PLAN_PRICES_CENTS, string> = {
  launch: "Launch",
  growth: "Growth",
  scale: "Scale",
};

export const PLAN_ORDER_LIMITS = {
  launch: 500,
  growth: 2_000,
  scale: 10_000,
} as const;

export const DIAGNOSTIC_TRIPWIRE_CENTS = 3_700;

export const PARTNER_COMMISSION_PCT: Record<keyof typeof PLAN_PRICES_CENTS, number> = {
  launch: 10,
  growth: 12,
  scale: 15,
};

export type PlanTier = keyof typeof PLAN_PRICES_CENTS;

export function recommendPlan(monthlyRevenueCents: number): PlanTier {
  if (monthlyRevenueCents >= 500_000_00) return "scale";
  if (monthlyRevenueCents >= 150_000_00) return "growth";
  return "launch";
}

export function formatPlanPrice(plan: PlanTier): string {
  return `R$ ${(PLAN_PRICES_CENTS[plan] / 100).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}
