import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface OperatorPerformanceRow {
  operatorId: string;
  operatorName: string;
  picksCompleted: number;
  packsCompleted: number;
  notFoundCount: number;
  picksPerHour: number;
  accuracyPercent: number;
}

export async function getOperatorPerformance(
  clientId: string,
  days = 30,
): Promise<OperatorPerformanceRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: waves } = await supabaseAdmin
    .from("pick_waves")
    .select("id")
    .eq("client_id", clientId)
    .gte("created_at", since.toISOString());

  const waveIds = (waves ?? []).map((w: { id: string }) => w.id);

  const stats = new Map<
    string,
    { picks: number; notFound: number; packs: number; name: string; firstAt: number; lastAt: number }
  >();

  if (waveIds.length) {
    const { data: tasks } = await supabaseAdmin
      .from("pick_tasks")
      .select("id, operator_id, updated_at, pick_task_lines(status)")
      .in("wave_id", waveIds)
      .not("operator_id", "is", null);

    for (const task of tasks ?? []) {
      const opId = task.operator_id as string;
      if (!opId) continue;
      const entry = stats.get(opId) ?? {
        picks: 0,
        notFound: 0,
        packs: 0,
        name: opId.slice(0, 8),
        firstAt: Number.MAX_SAFE_INTEGER,
        lastAt: 0,
      };

      const ts = new Date(task.updated_at as string).getTime();
      entry.firstAt = Math.min(entry.firstAt, ts);
      entry.lastAt = Math.max(entry.lastAt, ts);

      for (const line of (task.pick_task_lines as Array<{ status: string }> | null) ?? []) {
        if (line.status === "picked") entry.picks += 1;
        if (line.status === "not_found") entry.notFound += 1;
      }
      stats.set(opId, entry);
    }
  }

  const { data: packs } = await supabaseAdmin
    .from("packing_sessions")
    .select("operator_id, completed_at, orders!inner(client_id)")
    .eq("orders.client_id", clientId)
    .eq("status", "completed")
    .gte("completed_at", since.toISOString())
    .not("operator_id", "is", null);

  for (const pack of packs ?? []) {
    const opId = pack.operator_id as string;
    const entry = stats.get(opId) ?? {
      picks: 0,
      notFound: 0,
      packs: 0,
      name: opId.slice(0, 8),
      firstAt: Number.MAX_SAFE_INTEGER,
      lastAt: 0,
    };
    entry.packs += 1;
    const ts = new Date(pack.completed_at as string).getTime();
    entry.firstAt = Math.min(entry.firstAt, ts);
    entry.lastAt = Math.max(entry.lastAt, ts);
    stats.set(opId, entry);
  }

  const operatorIds = [...stats.keys()];
  if (operatorIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", operatorIds);

    for (const p of profiles ?? []) {
      const entry = stats.get(p.id as string);
      if (entry && p.full_name) entry.name = p.full_name as string;
    }
  }

  const rows: OperatorPerformanceRow[] = [];

  for (const [operatorId, entry] of stats) {
    const totalLines = entry.picks + entry.notFound;
    const hours = Math.max(0.5, (entry.lastAt - entry.firstAt) / (60 * 60 * 1000));
    rows.push({
      operatorId,
      operatorName: entry.name,
      picksCompleted: entry.picks,
      packsCompleted: entry.packs,
      notFoundCount: entry.notFound,
      picksPerHour: Math.round((entry.picks / hours) * 10) / 10,
      accuracyPercent:
        totalLines > 0 ? Math.round((entry.picks / totalLines) * 100) : 100,
    });
  }

  return rows.sort(
    (a, b) => b.picksCompleted + b.packsCompleted - (a.picksCompleted + a.packsCompleted),
  );
}
