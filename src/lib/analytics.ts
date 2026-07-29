import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

/**
 * Read-side aggregates for the dashboard. All scoped to one site + a date range.
 * Money is in minor units (cents); the UI divides by 100.
 */

export type Summary = {
  revenue: number; // minor units
  orders: number;
  sessions: number;
  visitors: number;
  conversionRate: number; // orders / sessions
  aov: number; // minor units
};

export type ChannelRow = { channel: string; revenue: number; orders: number };
export type CampaignRow = { campaign: string; revenue: number; orders: number };
export type RecentOrder = {
  id: string;
  orderNumber: string | null;
  totalAmount: number;
  currency: string;
  channel: string | null;
  placedAt: Date;
};
export type DayRow = { day: string; revenue: number; orders: number };

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getSummary(siteId: string, days: number): Promise<Summary> {
  const db = await getDb();
  const from = since(days);

  const [ordersAgg] = await db
    .select({
      revenue: sql<number>`coalesce(sum(${schema.orders.totalAmount}), 0)`,
      orders: sql<number>`count(*)`,
    })
    .from(schema.orders)
    .where(and(eq(schema.orders.siteId, siteId), gte(schema.orders.placedAt, from)));

  const [sessionsAgg] = await db
    .select({ sessions: sql<number>`count(*)` })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.siteId, siteId), gte(schema.sessions.startedAt, from)));

  const [visitorsAgg] = await db
    .select({ visitors: sql<number>`count(*)` })
    .from(schema.visitors)
    .where(and(eq(schema.visitors.siteId, siteId), gte(schema.visitors.firstSeenAt, from)));

  const revenue = Number(ordersAgg?.revenue ?? 0);
  const orders = Number(ordersAgg?.orders ?? 0);
  const sessions = Number(sessionsAgg?.sessions ?? 0);
  const visitors = Number(visitorsAgg?.visitors ?? 0);

  return {
    revenue,
    orders,
    sessions,
    visitors,
    conversionRate: sessions > 0 ? orders / sessions : 0,
    aov: orders > 0 ? Math.round(revenue / orders) : 0,
  };
}

export async function getRevenueByChannel(siteId: string, days: number): Promise<ChannelRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      channel: sql<string>`coalesce(${schema.orders.attributedChannel}, 'unknown')`,
      revenue: sql<number>`coalesce(sum(${schema.orders.totalAmount}), 0)`,
      orders: sql<number>`count(*)`,
    })
    .from(schema.orders)
    .where(and(eq(schema.orders.siteId, siteId), gte(schema.orders.placedAt, since(days))))
    .groupBy(sql`coalesce(${schema.orders.attributedChannel}, 'unknown')`)
    .orderBy(desc(sql`sum(${schema.orders.totalAmount})`));
  return rows.map((r) => ({ channel: r.channel, revenue: Number(r.revenue), orders: Number(r.orders) }));
}

export async function getTopCampaigns(siteId: string, days: number): Promise<CampaignRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      campaign: sql<string>`coalesce(${schema.orders.attributedCampaign}, '(none)')`,
      revenue: sql<number>`coalesce(sum(${schema.orders.totalAmount}), 0)`,
      orders: sql<number>`count(*)`,
    })
    .from(schema.orders)
    .where(and(eq(schema.orders.siteId, siteId), gte(schema.orders.placedAt, since(days))))
    .groupBy(sql`coalesce(${schema.orders.attributedCampaign}, '(none)')`)
    .orderBy(desc(sql`sum(${schema.orders.totalAmount})`))
    .limit(10);
  return rows.map((r) => ({ campaign: r.campaign, revenue: Number(r.revenue), orders: Number(r.orders) }));
}

export async function getRecentOrders(siteId: string, limit = 15): Promise<RecentOrder[]> {
  const db = await getDb();
  const rows = await db.query.orders.findMany({
    where: eq(schema.orders.siteId, siteId),
    orderBy: [desc(schema.orders.placedAt)],
    limit,
    columns: { id: true, orderNumber: true, totalAmount: true, currency: true, attributedChannel: true, placedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    orderNumber: r.orderNumber,
    totalAmount: r.totalAmount,
    currency: r.currency,
    channel: r.attributedChannel,
    placedAt: r.placedAt,
  }));
}

export type RoasRow = {
  channel: string;
  spend: number; // minor units
  revenue: number; // minor units
  orders: number;
  roas: number | null; // revenue / spend
};

function sinceStr(days: number): string {
  return since(days).toISOString().slice(0, 10);
}

// Total ad spend across all providers/channels in the range.
export async function getSpendTotal(siteId: string, days: number): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ spend: sql<number>`coalesce(sum(${schema.adSpend.spend}), 0)` })
    .from(schema.adSpend)
    .where(and(eq(schema.adSpend.siteId, siteId), gte(schema.adSpend.day, sinceStr(days))));
  return Number(row?.spend ?? 0);
}

// Join spend (by channel) to attributed revenue (by channel) → ROAS per channel.
export async function getRoasByChannel(siteId: string, days: number): Promise<RoasRow[]> {
  const db = await getDb();

  const spendRows = await db
    .select({
      channel: schema.adSpend.channel,
      spend: sql<number>`coalesce(sum(${schema.adSpend.spend}), 0)`,
    })
    .from(schema.adSpend)
    .where(and(eq(schema.adSpend.siteId, siteId), gte(schema.adSpend.day, sinceStr(days))))
    .groupBy(schema.adSpend.channel);

  const revenue = await getRevenueByChannel(siteId, days);

  // Merge both sides on channel; a channel can have spend, revenue, or both.
  const map = new Map<string, RoasRow>();
  for (const r of revenue) {
    map.set(r.channel, { channel: r.channel, spend: 0, revenue: r.revenue, orders: r.orders, roas: null });
  }
  for (const s of spendRows) {
    const spend = Number(s.spend);
    const existing = map.get(s.channel) ?? { channel: s.channel, spend: 0, revenue: 0, orders: 0, roas: null };
    existing.spend = spend;
    map.set(s.channel, existing);
  }
  const rows = [...map.values()].map((r) => ({
    ...r,
    roas: r.spend > 0 ? r.revenue / r.spend : null,
  }));
  // Paid channels (with spend) first, then by revenue.
  return rows.sort((a, b) => b.spend - a.spend || b.revenue - a.revenue);
}

export async function listSites() {
  const db = await getDb();
  return db.query.sites.findMany({ columns: { id: true, name: true, domain: true } });
}
