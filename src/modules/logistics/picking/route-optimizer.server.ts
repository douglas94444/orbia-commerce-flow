import type { WarehouseLocation } from "../wms/warehouse.server";

export interface PickLineWithLocation {
  sku: string;
  locationId: string | null;
  binCode: string;
  routeOrder: number;
  sortOrder: number;
}

export function optimizePickRoute(
  lines: Array<{ sku: string; locationId: string | null }>,
  locations: WarehouseLocation[],
): PickLineWithLocation[] {
  const locMap = new Map(locations.map((l) => [l.id, l]));

  return lines
    .map((line, idx) => {
      const loc = line.locationId ? locMap.get(line.locationId) : undefined;
      return {
        sku: line.sku,
        locationId: line.locationId,
        binCode: loc?.binCode ?? "—",
        routeOrder: loc?.routeOrder ?? 9999 + idx,
        sortOrder: idx,
      };
    })
    .sort((a, b) => a.routeOrder - b.routeOrder)
    .map((line, idx) => ({ ...line, sortOrder: idx }));
}
