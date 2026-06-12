import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DeliveryHeatPoint } from "@/modules/logistics/analytics/delivery-heatmap.server";

interface DeliveryHeatMapProps {
  points: DeliveryHeatPoint[];
}

export function DeliveryHeatMapChart({ points }: DeliveryHeatMapProps) {
  const mapped = points
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      name: `${p.city}${p.state ? `/${p.state}` : ""}`,
      lat: p.lat as number,
      lng: p.lng as number,
      volume: p.delivered + p.inTransit + p.incidents,
      delivered: p.delivered,
      inTransit: p.inTransit,
      incidents: p.incidents,
    }));

  if (mapped.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem coordenadas para as cidades do período — use a tabela abaixo.
      </p>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 16, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
          <XAxis
            type="number"
            dataKey="lng"
            name="Longitude"
            domain={["dataMin - 2", "dataMax + 2"]}
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => String(v)}
          />
          <YAxis
            type="number"
            dataKey="lat"
            name="Latitude"
            domain={["dataMin - 2", "dataMax + 2"]}
            tick={{ fontSize: 10 }}
          />
          <ZAxis type="number" dataKey="volume" range={[80, 400]} />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              const row = payload?.[0]?.payload as (typeof mapped)[0] | undefined;
              if (!row) return null;
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
                  <p className="font-medium">{row.name}</p>
                  <p>Entregues: {row.delivered}</p>
                  <p>Em trânsito: {row.inTransit}</p>
                  <p>Incidentes: {row.incidents}</p>
                </div>
              );
            }}
          />
          <Scatter name="Entregas" data={mapped} fill="oklch(0.82 0.14 195)" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
