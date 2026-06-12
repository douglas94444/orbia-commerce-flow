import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOpsPickQueue, getOpsPickOrderProgress } from "./ops-tasks.server";
import { listDispatchQueue } from "../shipping/dispatch-queue.server";
import { listUnifiedOccurrences } from "../analytics/occurrences-report.server";
import { getSlaDashboard } from "../sla/sla-engine.server";

export interface OpsLiveDashboard {
  pickQueueSize: number;
  pickUrgentCount: number;
  dispatchQueueSize: number;
  openIncidents: number;
  slaAtRisk: number;
  slaBreached: number;
  pickLines: Awaited<ReturnType<typeof getOpsPickQueue>>;
  orderProgress: Awaited<ReturnType<typeof getOpsPickOrderProgress>>;
}

export async function getOpsLiveDashboard(clientId: string): Promise<OpsLiveDashboard> {
  const [pickLines, orderProgress, dispatchQueue, occurrences, sla] = await Promise.all([
    getOpsPickQueue(clientId),
    getOpsPickOrderProgress(clientId),
    listDispatchQueue(clientId),
    listUnifiedOccurrences(clientId, 7),
    getSlaDashboard(clientId),
  ]);

  const now = Date.now();
  const pickUrgentCount = pickLines.filter((l) => {
    if (!l.slaDeadlineAt) return false;
    const hours = (new Date(l.slaDeadlineAt).getTime() - now) / (60 * 60 * 1000);
    return hours <= 6;
  }).length;

  const openIncidents = occurrences.filter(
    (o) => o.type === "incident" && o.status === "open",
  ).length;

  return {
    pickQueueSize: pickLines.length,
    pickUrgentCount,
    dispatchQueueSize: dispatchQueue.length,
    openIncidents,
    slaAtRisk: sla.atRisk,
    slaBreached: sla.breached,
    pickLines: pickLines.slice(0, 10),
    orderProgress: orderProgress.slice(0, 8),
  };
}
