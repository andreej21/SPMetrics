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

export async function listSites() {
  const db = await getDb();
  return db.query.sites.findMany({ columns: { id: true, name: true, domain: true } });
}
