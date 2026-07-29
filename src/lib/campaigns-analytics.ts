import { getDb } from "@/db/client";
import { adSpend, orders } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function getCampaignsMetrics(siteId: string, days: number = 30) {
  const db = await getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Aggregate spend data by campaign
  const spendData = await db
    .select({
      campaign: adSpend.campaign,
      campaignId: adSpend.campaignId,
      provider: adSpend.provider,
      source: adSpend.source,
      totalSpend: sql<number>`COALESCE(SUM(CAST(${adSpend.spend} AS BIGINT)), 0)`.as("totalSpend"),
      totalImpressions: sql<number>`COALESCE(SUM(CAST(${adSpend.impressions} AS BIGINT)), 0)`.as(
        "totalImpressions"
      ),
      totalClicks: sql<number>`COALESCE(SUM(CAST(${adSpend.clicks} AS BIGINT)), 0)`.as("totalClicks"),
    })
    .from(adSpend)
    .where(sql`${adSpend.siteId} = ${siteId} AND ${adSpend.day} >= ${cutoff}`)
    .groupBy(adSpend.campaign, adSpend.campaignId, adSpend.provider, adSpend.source)
    .orderBy(sql`COALESCE(SUM(CAST(${adSpend.spend} AS BIGINT)), 0) DESC`);

  // Get revenue attributed to each campaign
  const revenueData = await db
    .select({
      campaign: orders.attributedCampaign,
      totalRevenue: sql<number>`COALESCE(SUM(CAST(${orders.totalAmount} AS BIGINT)), 0)`.as(
        "totalRevenue"
      ),
      orderCount: sql<number>`COUNT(*)`.as("orderCount"),
    })
    .from(orders)
    .where(sql`${orders.siteId} = ${siteId} AND ${orders.placedAt} >= ${cutoff}`)
    .groupBy(orders.attributedCampaign);

  // Merge spend and revenue data
  const revenueMap = new Map(revenueData.map((r) => [r.campaign, r]));

  return spendData.map((spend) => {
    const revenue = revenueMap.get(spend.campaign) || { totalRevenue: 0, orderCount: 0 };
    const roas = spend.totalSpend > 0 ? revenue.totalRevenue / spend.totalSpend : 0;
    const ctr = spend.totalImpressions > 0 ? (spend.totalClicks / spend.totalImpressions) * 100 : 0;
    const cpc = spend.totalClicks > 0 ? spend.totalSpend / spend.totalClicks : 0;

    return {
      campaign: spend.campaign || "(not set)",
      campaignId: spend.campaignId,
      provider: spend.provider,
      source: spend.source,
      spend: spend.totalSpend,
      revenue: revenue.totalRevenue,
      roas,
      orders: revenue.orderCount,
      impressions: spend.totalImpressions,
      clicks: spend.totalClicks,
      ctr,
      cpc,
    };
  });
}
