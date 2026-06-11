import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface OrderShipmentSpecs {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

const BOX_DIMS_CM: Record<string, { l: number; w: number; h: number }> = {
  P: { l: 16, w: 11, h: 2 },
  M: { l: 30, w: 20, h: 10 },
  G: { l: 40, w: 30, h: 15 },
  XL: { l: 50, w: 40, h: 20 },
};

export async function computeOrderShipmentSpecs(orderId: string): Promise<OrderShipmentSpecs> {
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("metadata")
    .eq("id", orderId)
    .single();

  const meta = (order?.metadata ?? {}) as Record<string, unknown>;
  const metaWeight = Number(meta.packing_weight_kg);
  const metaL = Number(meta.packing_length_cm);
  const metaW = Number(meta.packing_width_cm);
  const metaH = Number(meta.packing_height_cm);

  if (metaWeight > 0 && metaL > 0 && metaW > 0 && metaH > 0) {
    return {
      weightKg: metaWeight,
      lengthCm: metaL,
      widthCm: metaW,
      heightCm: metaH,
    };
  }

  const { data: items } = await supabaseAdmin
    .from("order_items")
    .select("qty, products(weight_grams, length_mm, width_mm, height_mm)")
    .eq("order_id", orderId);

  let totalWeightGrams = 0;
  let maxL = 0;
  let maxW = 0;
  let maxH = 0;

  for (const item of items ?? []) {
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

  const { data: session } = await supabaseAdmin
    .from("packing_sessions")
    .select("box_type")
    .eq("order_id", orderId)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const box = BOX_DIMS_CM[(session?.box_type as string) ?? "P"] ?? BOX_DIMS_CM.P;

  return {
    weightKg: Math.max(0.1, totalWeightGrams / 1000),
    lengthCm: maxL > 0 ? Math.ceil(maxL / 10) : box.l,
    widthCm: maxW > 0 ? Math.ceil(maxW / 10) : box.w,
    heightCm: maxH > 0 ? Math.ceil(maxH / 10) : box.h,
  };
}
