import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "var(--foreground)",
} as const;

export interface GmvRoasPoint {
  day: string;
  gmv: number;
  roas: number;
}

export interface ChannelRoasPoint {
  channel: string;
  roas: number;
}

interface GmvRoasChartProps {
  data?: GmvRoasPoint[];
}

export function GmvRoasChart({ data = [] }: GmvRoasChartProps) {
  const chartData = data.length > 0 ? data : [{ day: "1", gmv: 0, roas: 0 }];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="gmvFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={false}
          interval={4}
        />
        <YAxis
          tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(l) => `Dia ${l}`}
          formatter={(value: number, name) =>
            name === "gmv"
              ? [`R$ ${new Intl.NumberFormat("pt-BR").format(value)}`, "GMV"]
              : [`${value}x`, "ROAS"]
          }
        />
        <Area
          type="monotone"
          dataKey="gmv"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#gmvFill)"
          dot={false}
          activeDot={{ r: 4, fill: "var(--primary)" }}
        />
        <Line type="monotone" dataKey="roas" stroke="var(--success)" strokeWidth={2} dot={false} yAxisId={0} hide />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface ChannelRoasChartProps {
  data?: ChannelRoasPoint[];
}

export function ChannelRoasChart({ data = [] }: ChannelRoasChartProps) {
  const colors = ["var(--primary)", "var(--chart-2)", "var(--chart-4)", "var(--success)"];
  const chartData = data.length > 0 ? data : [{ channel: "—", roas: 0 }];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="channel"
          tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}x`}
        />
        <Tooltip
          cursor={{ fill: "color-mix(in oklab, var(--foreground) 5%, transparent)" }}
          contentStyle={tooltipStyle}
          formatter={(value: number) => [`${value}x`, "ROAS"]}
        />
        <Bar dataKey="roas" radius={[6, 6, 0, 0]} maxBarSize={48}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
