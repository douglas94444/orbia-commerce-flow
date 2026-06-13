import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pollMlClaimsToSac } from "./ml-claims.server";
import { pollShopeeMessages } from "../channels/shopee-messaging.server";
import { pollAmazonMessages } from "../channels/amazon-messaging.server";
import { pollInstagramDm } from "../channels/instagram-messaging.server";

export async function runSacMarketplacePoll(): Promise<Record<string, number>> {
  const { data: clients } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("status", "active");

  let ml = 0;
  let shopee = 0;
  let amazon = 0;
  let instagram = 0;

  for (const client of clients ?? []) {
    ml += await pollMlClaimsToSac(client.id);
    shopee += await pollShopeeMessages(client.id);
    amazon += await pollAmazonMessages(client.id);
    instagram += await pollInstagramDm(client.id);
  }

  return { ml, shopee, amazon, instagram };
}
