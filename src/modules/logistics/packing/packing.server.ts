import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getPackingProfile } from "./packing-profile.server";

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

export interface PackingSessionStart {
  sessionId: string;
  checklist: string[];
  brandingUrl: string | null;
  insertMaterialSku: string | null;
}

export async function startPackingSession(
  orderId: string,
  operatorId: string,
): Promise<PackingSessionStart> {
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

  const profile = await getPackingProfile(order.client_id as string);
  return {
    sessionId: data.id as string,
    checklist: profile.checklistItems,
    brandingUrl: profile.brandingUrl,
    insertMaterialSku: profile.insertMaterialSku,
  };
}

export interface PackingOrderItem {
  sku: string;
  qty: number;
  packedQty: number;
}

export async function getPackingOrderItems(orderId: string): Promise<PackingOrderItem[]> {
  const { data, error } = await supabaseAdmin
    .from("order_items")
    .select("sku, qty, packed_qty")
    .eq("order_id", orderId)
    .order("sku");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    sku: row.sku as string,
    qty: row.qty as number,
    packedQty: (row.packed_qty as number) ?? 0,
  }));
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

  const { data: packItems } = await supabaseAdmin
    .from("order_items")
    .select("qty, packed_qty, products(weight_grams, length_mm, width_mm, height_mm)")
    .eq("order_id", session.order_id);

  const allPacked = (packItems ?? []).every(
    (i: { qty: number; packed_qty: number }) => i.packed_qty >= i.qty,
  );
  if (!allPacked) throw new Error("Confirme todos os itens antes de fechar");

  let totalWeightGrams = 0;
  let maxL = 0;
  let maxW = 0;
  let maxH = 0;
  for (const item of packItems ?? []) {
    const p = item.products as {
      weight_grams: number | null;
      length_mm: number | null;
      width_mm: number | null;
      height_mm: number | null;
    } | null;
    const w = p?.weight_grams ?? 200;
    totalWeightGrams += w * (item.qty as number);
    maxL = Math.max(maxL, p?.length_mm ?? 160);
    maxW = Math.max(maxW, p?.width_mm ?? 110);
    maxH = Math.max(maxH, p?.height_mm ?? 20);
  }

  const { data: packSession } = await supabaseAdmin
    .from("packing_sessions")
    .select("box_type")
    .eq("id", sessionId)
    .single();

  const { data: orderRow } = await supabaseAdmin
    .from("orders")
    .select("metadata")
    .eq("id", session.order_id)
    .single();

  const existingMeta = (orderRow?.metadata ?? {}) as Record<string, unknown>;

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
    .update({
      status: "em_packing",
      metadata: {
        ...existingMeta,
        packing_weight_kg: Math.max(0.1, totalWeightGrams / 1000),
        packing_length_cm: Math.ceil(maxL / 10) || 16,
        packing_width_cm: Math.ceil(maxW / 10) || 11,
        packing_height_cm: Math.ceil(maxH / 10) || 2,
        packing_box_type: packSession?.box_type ?? "P",
      },
    })
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
