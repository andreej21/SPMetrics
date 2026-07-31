import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export type Cohort = {
  month: string; // YYYY-MM
  channel: string | null;
  cohortSize: number;
  d30RepeatRate: number;
  d60RepeatRate: number;
  d90RepeatRate: number;
  d30Revenue: number;
  d60Revenue: number;
  d90Revenue: number;
};

export type LtvByCohort = {
  source: string | null;
  customerCount: number;
  lifetimeRevenue: number;
  avgLtv: number;
  avgOrders: number;
};

export async function getCohorts(siteId: string): Promise<Cohort[]> {
  const db = await getDb();

  const firstOrders = await db
    .select({
      visitorId: schema.orders.visitorId,
      identityId: schema.orders.identityId,
      month: sql<string>`to_char(${schema.orders.placedAt}, 'YYYY-MM')`.as("month"),
      channel: schema.orders.attributedChannel,
      totalAmount: schema.orders.totalAmount,
      placedAt: schema.orders.placedAt,
    })
    .from(schema.orders)
    .where(eq(schema.orders.siteId, siteId))
    .orderBy(schema.orders.placedAt);

  if (firstOrders.length === 0) {
    return [];
  }

  const firstOrderByIdentity = new Map<
    string,
    { month: string; channel: string | null; placedAt: Date }
  >();

  for (const order of firstOrders) {
    const key = order.identityId || order.visitorId;
    if (!key) continue;
    if (!firstOrderByIdentity.has(key)) {
      firstOrderByIdentity.set(key, {
        month: order.month,
        channel: order.channel,
        placedAt: order.placedAt,
      });
    }
  }

  const allOrders = await db
    .select({
      visitorId: schema.orders.visitorId,
      identityId: schema.orders.identityId,
      totalAmount: schema.orders.totalAmount,
      placedAt: schema.orders.placedAt,
    })
    .from(schema.orders)
    .where(eq(schema.orders.siteId, siteId));

  const cohortMap = new Map<string, Cohort>();

  for (const order of allOrders) {
    const key = order.identityId || order.visitorId;
    if (!key) continue;

    const cohortInfo = firstOrderByIdentity.get(key);
    if (!cohortInfo) continue;

    const cohortKey = `${cohortInfo.month}|${cohortInfo.channel ?? "direct"}`;
    let cohort = cohortMap.get(cohortKey);

    if (!cohort) {
      cohort = {
        month: cohortInfo.month,
        channel: cohortInfo.channel,
        cohortSize: 0,
        d30RepeatRate: 0,
        d60RepeatRate: 0,
        d90RepeatRate: 0,
        d30Revenue: 0,
        d60Revenue: 0,
        d90Revenue: 0,
      };
      cohortMap.set(cohortKey, cohort);
    }

    const daysSinceFirstOrder = (order.placedAt.getTime() - cohortInfo.placedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceFirstOrder <= 30) {
      cohort.d30Revenue += order.totalAmount;
    }
    if (daysSinceFirstOrder <= 60) {
      cohort.d60Revenue += order.totalAmount;
    }
    if (daysSinceFirstOrder <= 90) {
      cohort.d90Revenue += order.totalAmount;
    }
  }

  for (const order of firstOrders) {
    const key = order.identityId || order.visitorId;
    if (!key) continue;

    const cohortInfo = firstOrderByIdentity.get(key);
    if (!cohortInfo) continue;

    const cohortKey = `${cohortInfo.month}|${cohortInfo.channel ?? "direct"}`;
    const cohort = cohortMap.get(cohortKey);
    if (!cohort) continue;

    if (order.placedAt.getTime() === cohortInfo.placedAt.getTime()) {
      cohort.cohortSize += 1;
    }
  }

  const repeatOrders = new Map<string, Set<string>>();

  for (const order of allOrders) {
    const key = order.identityId || order.visitorId;
    if (!key) continue;

    const cohortInfo = firstOrderByIdentity.get(key);
    if (!cohortInfo || order.placedAt.getTime() === cohortInfo.placedAt.getTime()) {
      continue;
    }

    const daysSinceFirstOrder = (order.placedAt.getTime() - cohortInfo.placedAt.getTime()) / (1000 * 60 * 60 * 24);
    const cohortKey = `${cohortInfo.month}|${cohortInfo.channel ?? "direct"}`;

    if (daysSinceFirstOrder <= 30) {
      const set30 = repeatOrders.get(`${cohortKey}|d30`) || new Set();
      set30.add(key);
      repeatOrders.set(`${cohortKey}|d30`, set30);
    }
    if (daysSinceFirstOrder <= 60) {
      const set60 = repeatOrders.get(`${cohortKey}|d60`) || new Set();
      set60.add(key);
      repeatOrders.set(`${cohortKey}|d60`, set60);
    }
    if (daysSinceFirstOrder <= 90) {
      const set90 = repeatOrders.get(`${cohortKey}|d90`) || new Set();
      set90.add(key);
      repeatOrders.set(`${cohortKey}|d90`, set90);
    }
  }

  for (const cohort of cohortMap.values()) {
    const cohortKey = `${cohort.month}|${cohort.channel ?? "direct"}`;
    if (cohort.cohortSize > 0) {
      const repeat30 = repeatOrders.get(`${cohortKey}|d30`)?.size || 0;
      const repeat60 = repeatOrders.get(`${cohortKey}|d60`)?.size || 0;
      const repeat90 = repeatOrders.get(`${cohortKey}|d90`)?.size || 0;

      cohort.d30RepeatRate = repeat30 / cohort.cohortSize;
      cohort.d60RepeatRate = repeat60 / cohort.cohortSize;
      cohort.d90RepeatRate = repeat90 / cohort.cohortSize;
    }
  }

  return Array.from(cohortMap.values()).sort((a, b) => b.month.localeCompare(a.month));
}

export async function getLtvBySource(siteId: string, days: number): Promise<LtvByCohort[]> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await db
    .select({
      visitorId: schema.orders.visitorId,
      identityId: schema.orders.identityId,
      attributedSource: schema.orders.attributedSource,
      totalAmount: schema.orders.totalAmount,
    })
    .from(schema.orders)
    .where(and(eq(schema.orders.siteId, siteId), gte(schema.orders.placedAt, cutoff)));

  const sourceMetrics = new Map<
    string | null,
    { customers: Set<string>; totalRevenue: number; orderCount: number }
  >();

  for (const order of orders) {
    const key = order.identityId || order.visitorId;
    if (!key) continue;

    const source = order.attributedSource || "direct";
    const metrics = sourceMetrics.get(source) || {
      customers: new Set(),
      totalRevenue: 0,
      orderCount: 0,
    };

    metrics.customers.add(key);
    metrics.totalRevenue += order.totalAmount;
    metrics.orderCount += 1;
    sourceMetrics.set(source, metrics);
  }

  return Array.from(sourceMetrics.entries())
    .map(([source, metrics]) => ({
      source: source === "direct" ? null : source,
      customerCount: metrics.customers.size,
      lifetimeRevenue: metrics.totalRevenue,
      avgLtv: metrics.customers.size > 0 ? Math.round(metrics.totalRevenue / metrics.customers.size) : 0,
      avgOrders: metrics.customers.size > 0 ? Math.round((metrics.orderCount / metrics.customers.size) * 100) / 100 : 0,
    }))
    .sort((a, b) => (b.lifetimeRevenue || 0) - (a.lifetimeRevenue || 0));
}
