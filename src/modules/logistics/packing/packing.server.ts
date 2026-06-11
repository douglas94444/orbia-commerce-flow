import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface BoxSuggestion {
  boxType: string;
  reason: string;
}

export function suggestBoxType(
  totalWeightGrams: number,
  maxDimensionMm: number,
): BoxSuggestion {
  if (totalWeightGrams <= 500 && maxDimensionMm <= 200) {
    return { boxType: "P", reason: "Pacote pequeno — até 500g" };
  }
  if (totalWeightGrams <= 2000 && maxDimensionMm <= 400) {
    return { boxType: "M", reason: "Pacote médio — até 2kg" };
  }
  if (totalWeightGrams <= 5000) {
    return { boxType: "G", reason: "Pacote grande — até 5kg" };
  }
  return { boxType: "XL", reason: "Pacote extra grande" };
}

export async function startPackingSession(
  orderId: string,
  operatorId: string,
): Promise<string> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, client_id, status")
    .eq("id", orderId)
    .single();

  if (!order || order.status !== "em_packing") {
    throw new Error("Pedido não está em packing");
  }

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("sku, qty, products(weight_grams, length_mm, width_mm, height_mm)")
    .eq("order_id", orderId);

  let totalWeight = 0;
  let maxDim = 0;
  for (const item of items ?? []) {
    const p = item.products as {
      weight_grams: number | null;
      length_mm: number | null;
      width_mm: number | null;
      height_mm: number | null;
    } | null;
    const w = p?.weight_grams ?? 200;
    totalWeight += w * (item.qty as number);
    const dims = [p?.length_mm, p?.width_mm, p?.height_mm].filter(Boolean) as number[];
    if (dims.length) maxDim = Math.max(maxDim, ...dims);
  }

  const suggestion = suggestBoxType(totalWeight, maxDim);

  const { data, error } = await supabaseAdmin
    .from("packing_sessions")
    .insert({
      order_id: orderId,
      operator_id: operatorId,
      box_type: suggestion.boxType,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function confirmPackingItem(
  orderId: string,
  sku: string,
  qty: number,
): Promise<void> {
  const { data: item } = await supabaseAdmin
    .from("order_items")
    .select("id, qty, picked_qty")
    .eq("order_id", orderId)
    .eq("sku", sku)
    .single();

  if (!item) throw new Error("Item não encontrado");
  if ((item.picked_qty as number) < qty) {
    throw new Error("Item ainda não foi separado completamente");
  }

  await supabaseAdmin
    .from("order_items")
    .update({ packed_qty: qty })
    .eq("id", item.id);
}

async function uploadPackingEvidence(
  clientId: string,
  sessionId: string,
  photoUrls: string[],
): Promise<string[]> {
  const stored: string[] = [];

  for (let i = 0; i < photoUrls.length; i += 1) {
    const url = photoUrls[i];
    const match = url.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) {
      stored.push(url);
      continue;
    }

    const ext = match[1] === "jpeg" ? "jpg" : match[1];
    const buffer = Buffer.from(match[2], "base64");
    const path = `${clientId}/${sessionId}/${i}.${ext}`;

    const { error } = await supabaseAdmin.storage.from("fulfillment-evidence").upload(path, buffer, {
      contentType: `image/${match[1]}`,
      upsert: true,
    });

    if (error) throw new Error(`Falha no upload da foto: ${error.message}`);
    stored.push(path);
  }

  return stored;
}

export async function completePackingSession(
  sessionId: string,
  photoUrls: string[] = [],
): Promise<void> {
  const { data: session } = await supabaseAdmin
    .from("packing_sessions")
    .select("order_id, orders(client_id)")
    .eq("id", sessionId)
    .single();

  if (!session) throw new Error("Sessão não encontrada");

  const clientId = (session.orders as { client_id: string } | null)?.client_id;
  const storedPhotos =
    clientId && photoUrls.length ? await uploadPackingEvidence(clientId, sessionId, photoUrls) : photoUrls;

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("qty, packed_qty")
    .eq("order_id", session.order_id);

  const allPacked = (items ?? []).every(
    (i: { qty: number; packed_qty: number }) => i.packed_qty >= i.qty,
  );
  if (!allPacked) throw new Error("Confirme todos os itens antes de fechar");

  await supabaseAdmin
    .from("packing_sessions")
    .update({
      status: "completed",
      photo_urls: storedPhotos,
      completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  await supabaseAdmin
    .from("orders")
    .update({ status: "separacao" })
    .eq("id", session.order_id);

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("client_id")
    .eq("id", session.order_id)
    .single();

  if (order?.client_id) {
    const { recordFulfillmentUsage } = await import("../forecast/volume-forecast.server");
    await recordFulfillmentUsage(order.client_id as string, "packs_completed");
  }
}
