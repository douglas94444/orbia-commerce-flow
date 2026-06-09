import { shopeeFetch } from "./client";

export interface CatalogProductRow {
  sku: string;
  name: string;
  priceCents: number | null;
  externalProductId: string;
  externalVariantId: string;
  stockQty: number;
}

interface ShopeeItemListResponse {
  response: {
    item: Array<{ item_id: number; item_sku?: string }>;
    total_count: number;
    has_next_page: boolean;
    next_offset: number;
  };
}

interface ShopeeItemDetailResponse {
  response: {
    item_list: Array<{
      item_id: number;
      item_name: string;
      item_sku?: string;
      price_info?: Array<{ current_price: number }>;
      stock_info_v2?: { summary_info?: { total_available_stock: number } };
      model_list?: Array<{
        model_id: number;
        model_sku?: string;
        stock_info_v2?: { summary_info?: { total_available_stock: number } };
      }>;
    }>;
  };
}

export async function pullShopeeProducts(
  shopId: string,
  accessToken: string,
): Promise<CatalogProductRow[]> {
  const rows: CatalogProductRow[] = [];
  let offset = 0;
  const pageSize = 50;

  while (true) {
    const list = await shopeeFetch<ShopeeItemListResponse>(
      "/api/v2/product/get_item_list",
      shopId,
      accessToken,
      {
        method: "GET",
      },
    );

    const items = list.response?.item ?? [];
    if (!items.length) break;

    const itemIds = items.map((i) => i.item_id);
    const detail = await shopeeFetch<ShopeeItemDetailResponse>(
      "/api/v2/product/get_item_base_info",
      shopId,
      accessToken,
      {
        method: "GET",
      },
    );

    for (const item of detail.response?.item_list ?? []) {
      const price = item.price_info?.[0]?.current_price ?? 0;
      const models = item.model_list?.length ? item.model_list : [{ model_id: item.item_id, model_sku: item.item_sku, stock_info_v2: item.stock_info_v2 }];

      for (const model of models) {
        const sku = model.model_sku?.trim() || item.item_sku?.trim() || `SHOPEE-${model.model_id}`;
        rows.push({
          sku,
          name: item.item_name,
          priceCents: Math.round(price * 100),
          externalProductId: String(item.item_id),
          externalVariantId: String(model.model_id),
          stockQty: model.stock_info_v2?.summary_info?.total_available_stock ?? 0,
        });
      }
    }

    if (!list.response?.has_next_page) break;
    offset = list.response.next_offset ?? offset + pageSize;
    if (offset > 500) break;
  }

  return rows;
}

export async function pushShopeeStock(
  shopId: string,
  accessToken: string,
  itemId: string,
  modelId: string,
  qty: number,
): Promise<void> {
  await shopeeFetch("/api/v2/product/update_stock", shopId, accessToken, {
    method: "POST",
    body: JSON.stringify({
      item_id: Number(itemId),
      stock_list: [
        {
          model_id: Number(modelId),
          seller_stock: [{ stock: qty }],
        },
      ],
    }),
  });
}
