import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PARTNER_COMMISSION_PCT, PLAN_PRICES_CENTS, type PlanTier } from "@/shared/constants/plans";

function generateReferralCode(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6);
  return `${base}${Math.random().toString(36).slice(2, 6)}`;
}

export async function registerPartner(input: {
  name: string;
  email: string;
}): Promise<{ id: string; referralCode: string }> {
  const referralCode = generateReferralCode(input.name);
  const { data, error } = await supabaseAdmin
    .from("sales_partners")
    .insert({
      name: input.name,
      email: input.email,
      referral_code: referralCode,
      status: "pending",
    })
    .select("id, referral_code")
    .single();

  if (error) throw new Error(error.message);
  return { id: data.id, referralCode: data.referral_code };
}

export async function resolvePartnerByReferral(
  referralCode: string,
): Promise<{ id: string; name: string } | null> {
  const { data } = await supabaseAdmin
    .from("sales_partners")
    .select("id, name")
    .eq("referral_code", referralCode)
    .eq("status", "active")
    .maybeSingle();
  return data ? { id: data.id, name: data.name } : null;
}

export async function createPartnerCommission(
  partnerId: string,
  prospectId: string,
  clientId: string,
  plan: PlanTier,
): Promise<void> {
  const mrrCents = PLAN_PRICES_CENTS[plan];
  const pct = PARTNER_COMMISSION_PCT[plan];
  const commissionCents = Math.round(mrrCents * (pct / 100));
  const periodMonth = new Date().toISOString().slice(0, 7) + "-01";

  await supabaseAdmin.from("sales_partner_commissions").insert({
    partner_id: partnerId,
    prospect_id: prospectId,
    client_id: clientId,
    plan,
    commission_pct: pct,
    mrr_cents: mrrCents,
    commission_cents: commissionCents,
    period_month: periodMonth,
    status: "pending",
  });
}

export async function getPartnerDashboard(partnerId: string) {
  const [partner, prospects, commissions] = await Promise.all([
    supabaseAdmin.from("sales_partners").select("*").eq("id", partnerId).single(),
    supabaseAdmin
      .from("sales_prospects")
      .select("id, company_name, stage_id, temperature, created_at, sales_pipeline_stages(label)")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("sales_partner_commissions")
      .select("*")
      .eq("partner_id", partnerId)
      .order("period_month", { ascending: false }),
  ]);

  const totalCommission = (commissions.data ?? [])
    .filter((c) => c.status !== "cancelled")
    .reduce((s, c) => s + c.commission_cents, 0);

  const converted = (prospects.data ?? []).filter((p) =>
    (p.sales_pipeline_stages as { label?: string } | null)?.label?.includes("ativo"),
  ).length;

  return {
    partner: partner.data,
    prospects: prospects.data ?? [],
    commissions: commissions.data ?? [],
    stats: {
      totalLeads: prospects.data?.length ?? 0,
      converted,
      totalCommissionCents: totalCommission,
      mrrGeneratedCents: (commissions.data ?? []).reduce((s, c) => s + c.mrr_cents, 0),
    },
  };
}

export async function computePartnerTier(partnerId: string): Promise<string> {
  const { count } = await supabaseAdmin
    .from("sales_prospects")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .not("converted_client_id", "is", null);

  const converted = count ?? 0;
  let tier = "bronze";
  if (converted >= 10) tier = "diamond";
  else if (converted >= 5) tier = "gold";
  else if (converted >= 2) tier = "silver";

  await supabaseAdmin.from("sales_partners").update({ tier }).eq("id", partnerId);
  return tier;
}

export async function getPartnerRanking(): Promise<
  Array<{ id: string; name: string; tier: string; converted: number }>
> {
  const { data: partners } = await supabaseAdmin
    .from("sales_partners")
    .select("id, name, tier")
    .eq("status", "active");

  const ranking = [];
  for (const p of partners ?? []) {
    const { count } = await supabaseAdmin
      .from("sales_prospects")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", p.id)
      .not("converted_client_id", "is", null);
    ranking.push({ id: p.id, name: p.name, tier: p.tier, converted: count ?? 0 });
  }

  return ranking.sort((a, b) => b.converted - a.converted);
}
