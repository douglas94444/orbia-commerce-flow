import { mlFetch } from "./client";

export interface CatalogProductRow {
  sku: string;
  name: string;
  priceCents: number | null;
  externalProductId: string;
  externalVariantId: string;
  stockQty: number;
  ncm?: string | null;
}

interface MlSearchResponse {
  results: string[];
  paging: { total: number; offset: number; limit: number };
}

interface MlItem {
  id: string;
  title: string;
  price: number;
  available_quantity: number;
  seller_custom_field?: string;
  attributes?: Array<{ id: string; value_name?: string; value_id?: string }>;
}

function extractMlNcm(item: MlItem): string | null {
  const attr = item.attributes?.find(
    (a) => a.id === "NCM" || a.id.toLowerCase().includes("ncm"),
  );
  const raw = attr?.value_name?.replace(/\D/g, "") ?? "";
  return raw.length === 8 ? raw : null;
}

export async function pullMercadoLivreProducts(
  userId: string,
  accessToken: string,
): Promise<CatalogProductRow[]> {
  const rows: CatalogProductRow[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const search = await mlFetch<MlSearchResponse>(
      `/users/${userId}/items/search?offset=${offset}&limit=${limit}`,
      accessToken,
    );
    const ids = search.results ?? [];
    if (!ids.length) break;

    for (const itemId of ids) {
      const item = await mlFetch<MlItem>(`/items/${itemId}`, accessToken);
      const sku = item.seller_custom_field?.trim() || item.id;
      rows.push({
        sku,
        name: item.title,
        priceCents: Math.round(Number(item.price ?? 0) * 100),
        externalProductId: item.id,
        externalVariantId: item.id,
        stockQty: item.available_quantity ?? 0,
        ncm: extractMlNcm(item),
      });
    }

    offset += limit;
    if (offset >= (search.paging?.total ?? 0)) break;
  }

  return rows;
}

export async function pushMercadoLivreStock(
  itemId: string,
  accessToken: string,
  qty: number,
): Promise<void> {
  await mlFetch(`/items/${itemId}`, accessToken, {
    method: "PUT",
    body: JSON.stringify({ available_quantity: qty }),
  });
}
