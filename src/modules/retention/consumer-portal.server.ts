import { randomBytes, createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getServerConfig } from "@/lib/config.server";

const TOKEN_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createConsumerPortalToken(
  clientId: string,
  customerId: string,
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

  await supabaseAdmin.from("consumer_portal_tokens").insert({
    client_id: clientId,
    customer_id: customerId,
    token_hash: hashToken(token),
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

export async function createConsumerPortalLink(
  clientId: string,
  customerId: string,
): Promise<string> {
  const token = await createConsumerPortalToken(clientId, customerId);
  const { appUrl } = getServerConfig();
  return `${appUrl}/minha-conta/${token}`;
}

export interface ConsumerSession {
  clientId: string;
  customerId: string;
  token: string;
}

export async function resolveConsumerSession(token: string): Promise<ConsumerSession | null> {
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();

  const { data: row } = await supabaseAdmin
    .from("consumer_portal_tokens")
    .select("client_id, customer_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .gt("expires_at", now)
    .maybeSingle();

  if (!row) return null;

  if (!row.used_at) {
    await supabaseAdmin
      .from("consumer_portal_tokens")
      .update({ used_at: now })
      .eq("token_hash", tokenHash);
  }

  return {
    clientId: row.client_id as string,
    customerId: row.customer_id as string,
    token,
  };
}

export async function getConsumerLoyaltyByCustomer(
  clientId: string,
  customerId: string,
) {
  const { data: account } = await supabaseAdmin
    .from("loyalty_accounts")
    .select("id, points_balance, tier, tier_progress_pct")
    .eq("customer_id", customerId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (!account) return { account: null, customerId, transactions: [] };

  const { data: transactions } = await supabaseAdmin
    .from("loyalty_transactions")
    .select("type, points, created_at, order_id")
    .eq("account_id", account.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: prefs } = await supabaseAdmin
    .from("customer_contact_prefs")
    .select("contact_email")
    .eq("customer_id", customerId)
    .maybeSingle();

  return {
    customerId,
    customerName: prefs?.contact_email ? String(prefs.contact_email).split("@")[0] : null,
    account,
    transactions: transactions ?? [],
  };
}
