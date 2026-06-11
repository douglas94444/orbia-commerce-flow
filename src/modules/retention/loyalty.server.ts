import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { enrollInSequence } from "./enrollment.server";

const TIER_THRESHOLDS = { bronze: 0, prata: 500, ouro: 2000, platina: 5000 } as const;
type Tier = keyof typeof TIER_THRESHOLDS;

function computeTier(points: number): Tier {
  if (points >= TIER_THRESHOLDS.platina) return "platina";
  if (points >= TIER_THRESHOLDS.ouro) return "ouro";
  if (points >= TIER_THRESHOLDS.prata) return "prata";
  return "bronze";
}

function tierProgress(points: number, tier: Tier): number {
  const tiers: Tier[] = ["bronze", "prata", "ouro", "platina"];
  const idx = tiers.indexOf(tier);
  if (idx >= tiers.length - 1) return 100;
  const next = tiers[idx + 1];
  const range = TIER_THRESHOLDS[next] - TIER_THRESHOLDS[tier];
  const progress = points - TIER_THRESHOLDS[tier];
  return Math.min(100, Math.round((progress / range) * 100));
}

export async function earnPointsFromOrder(
  customerId: string,
  clientId: string,
  orderId: string,
  valueCents: number,
): Promise<{ points: number; balance: number }> {
  const points = Math.floor(valueCents / 100);
  if (points <= 0) return { points: 0, balance: 0 };

  const { data: account } = await supabaseAdmin
    .from("loyalty_accounts")
    .select("id, points_balance")
    .eq("customer_id", customerId)
    .maybeSingle();

  let accountId = account?.id;
  const newBalance = (account?.points_balance ?? 0) + points;

  if (!accountId) {
    const tier = computeTier(newBalance);
    const { data: created } = await supabaseAdmin
      .from("loyalty_accounts")
      .insert({
        customer_id: customerId,
        client_id: clientId,
        points_balance: newBalance,
        tier,
        tier_progress_pct: tierProgress(newBalance, tier),
      })
      .select("id")
      .single();
    accountId = created?.id;
  } else {
    const tier = computeTier(newBalance);
    await supabaseAdmin
      .from("loyalty_accounts")
      .update({
        points_balance: newBalance,
        tier,
        tier_progress_pct: tierProgress(newBalance, tier),
        updated_at: new Date().toISOString(),
      })
      .eq("id", accountId);
  }

  if (accountId) {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await supabaseAdmin.from("loyalty_transactions").insert({
      account_id: accountId,
      type: "earn",
      points,
      order_id: orderId,
      expires_at: expiresAt.toISOString(),
    });
  }

  await enrollInSequence({
    clientId,
    trigger: "fidelidade_pontos",
    customerId,
    context: { points: newBalance, earned: points, order_id: orderId },
  });

  return { points, balance: newBalance };
}

export async function redeemPoints(
  customerId: string,
  clientId: string,
  pointsToRedeem: number,
): Promise<{ couponCode: string } | null> {
  const { data: account } = await supabaseAdmin
    .from("loyalty_accounts")
    .select("id, points_balance")
    .eq("customer_id", customerId)
    .single();

  if (!account || account.points_balance < pointsToRedeem) return null;

  const newBalance = account.points_balance - pointsToRedeem;
  const couponCode = `ORBIA${Date.now().toString(36).toUpperCase()}`;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await supabaseAdmin
    .from("loyalty_accounts")
    .update({ points_balance: newBalance, updated_at: new Date().toISOString() })
    .eq("id", account.id);

  await supabaseAdmin.from("loyalty_transactions").insert({
    account_id: account.id,
    type: "redeem",
    points: -pointsToRedeem,
  });

  await supabaseAdmin.from("loyalty_coupons").insert({
    account_id: account.id,
    code: couponCode,
    discount_pct: 10,
    expires_at: expiresAt.toISOString(),
    sent_via: "whatsapp",
  });

  await enrollInSequence({
    clientId,
    trigger: "fidelidade_cupom",
    customerId,
    context: { coupon_code: couponCode, points_redeemed: pointsToRedeem },
  });

  return { couponCode };
}

export async function processExpiringPoints(): Promise<{ notified: number }> {
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);

  const { data: expiring } = await supabaseAdmin
    .from("loyalty_transactions")
    .select("account_id, points")
    .eq("type", "earn")
    .lte("expires_at", in30Days.toISOString())
    .gte("expires_at", new Date().toISOString());

  let notified = 0;
  for (const tx of expiring ?? []) {
    const { data: account } = await supabaseAdmin
      .from("loyalty_accounts")
      .select("customer_id, client_id, points_balance")
      .eq("id", tx.account_id)
      .single();
    if (!account) continue;
    await enrollInSequence({
      clientId: account.client_id,
      trigger: "fidelidade_expira",
      customerId: account.customer_id,
      context: { points: account.points_balance, expiring_points: tx.points },
    });
    notified += 1;
  }
  return { notified };
}

export async function processTierReminders(): Promise<{ notified: number }> {
  const { data: accounts } = await supabaseAdmin
    .from("loyalty_accounts")
    .select("customer_id, client_id, points_balance, tier, tier_progress_pct")
    .gte("tier_progress_pct", 80)
    .lt("tier_progress_pct", 100);

  let notified = 0;
  for (const a of accounts ?? []) {
    await enrollInSequence({
      clientId: a.client_id,
      trigger: "fidelidade_tier",
      customerId: a.customer_id,
      context: { points: a.points_balance, tier: a.tier, progress: a.tier_progress_pct },
    });
    notified += 1;
  }
  return { notified };
}
