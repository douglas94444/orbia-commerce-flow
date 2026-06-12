import { getLogisticsAnalytics, type LogisticsAnalyticsSummary } from "./logistics-analytics.server";
import { getStageDurations, type StageDurationRow } from "./stage-duration.server";
import {
  getShippingCostByCarrier,
  getMonthlyShippingCosts,
  type CarrierCostRow,
  type MonthlyShippingCostRow,
} from "./shipping-cost-by-carrier.server";
import { getOrdersByChannel, type ChannelVolumeRow } from "./orders-by-channel.server";

export interface LogisticsAnalyticsDashboard {
  summary: LogisticsAnalyticsSummary;
  stageDurations: StageDurationRow[];
  carrierCosts: CarrierCostRow[];
  monthlyShippingCosts: MonthlyShippingCostRow[];
  channelVolume: ChannelVolumeRow[];
}

export async function getLogisticsAnalyticsDashboard(
  clientId: string,
): Promise<LogisticsAnalyticsDashboard> {
  const [summary, stageDurations, carrierCosts, monthlyShippingCosts, channelVolume] =
    await Promise.all([
      getLogisticsAnalytics(clientId),
      getStageDurations(clientId),
      getShippingCostByCarrier(clientId),
      getMonthlyShippingCosts(clientId),
      getOrdersByChannel(clientId),
    ]);

  return { summary, stageDurations, carrierCosts, monthlyShippingCosts, channelVolume };
}
