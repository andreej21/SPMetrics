import { and, eq, gte, lte, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export interface ViewThroughAttribution {
  source: string | null;
  channel: string | null;
  provider: string;
  viewThroughRevenue: number;
  viewThroughOrders: number;
  clickThroughRevenue: number;
  clickThroughOrders: number;
  totalRevenue: number;
  totalOrders: number;
  vt_pct: number; // % of revenue from view-through vs click-through
}

/**
 * Get view-through attribution: conversions where visitor saw an impression
 * but didn't click (no session matched the impression's channel).
 */
export async function getViewThroughAttribution(
  siteId: string,
  days: number,
): Promise<ViewThroughAttribution[]> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get all impressions in the window
  const impressions = await db.query.impressions.findMany({
    where: and(
      eq(schema.impressions.siteId, siteId),
      gte(schema.impressions.impressedAt, cutoff),
    ),
    columns: {
      visitorId: true,
      channel: true,
      source: true,
      provider: true,
      viewThroughWindow: true,
      impressedAt: true,
    },
  });

  if (impressions.length === 0) {
    return [];
  }

  const visitorIds = [...new Set(impressions.map((i) => i.visitorId).filter(Boolean) as string[])];

  // Get all orders for those visitors in the window
  const orders = await db.query.orders.findMany({
    where: and(
      eq(schema.orders.siteId, siteId),
      inArray(schema.orders.visitorId, visitorIds),
      gte(schema.orders.placedAt, cutoff),
    ),
    columns: {
      visitorId: true,
      totalAmount: true,
      attributedChannel: true,
      attributedSource: true,
      placedAt: true,
    },
  });

  if (orders.length === 0) {
    return [];
  }

  // Build impression map by visitor
  const impressionsByVisitor = new Map<
    string,
    Array<{
      channel: string | null;
      source: string | null;
      provider: string;
      viewThroughWindow: number;
      impressedAt: Date;
    }>
  >();

  for (const imp of impressions) {
    if (!imp.visitorId) continue;
    const list = impressionsByVisitor.get(imp.visitorId) || [];
    list.push(imp);
    impressionsByVisitor.set(imp.visitorId, list);
  }

  // Categorize orders as view-through or click-through
  const vt = new Map<
    string,
    {
      source: string | null;
      channel: string | null;
      provider: string;
      revenue: number;
      orders: number;
    }
  >();

  const ct = new Map<
    string,
    {
      source: string | null;
      channel: string | null;
      provider: string;
      revenue: number;
      orders: number;
    }
  >();

  for (const order of orders) {
    if (!order.visitorId) continue;

    const visitorImpressions = impressionsByVisitor.get(order.visitorId) || [];

    // Check if any impression matches the order's attributed channel
    let hasMatchingClick = false;
    for (const imp of visitorImpressions) {
      const daysOld = (order.placedAt.getTime() - imp.impressedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld <= imp.viewThroughWindow && imp.channel === order.attributedChannel) {
        hasMatchingClick = true;
        break;
      }
    }

    if (hasMatchingClick) {
      // This order is attributed to a click (matching session/channel)
      // So attribute to the channel
      const key = `${order.attributedChannel}`;
      const current =
        ct.get(key) ||
        ({ source: order.attributedSource, channel: order.attributedChannel, provider: "click", revenue: 0, orders: 0 } as any);
      current.revenue += order.totalAmount;
      current.orders += 1;
      ct.set(key, current);
    } else {
      // View-through: user saw impression(s) but no session matched the channel
      // Attribute to the most recent impression within the window
      let bestImp = null;
      let bestDaysOld = Infinity;

      for (const imp of visitorImpressions) {
        const daysOld = (order.placedAt.getTime() - imp.impressedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysOld <= imp.viewThroughWindow && daysOld < bestDaysOld) {
          bestImp = imp;
          bestDaysOld = daysOld;
        }
      }

      if (bestImp) {
        const key = `${bestImp.channel}|${bestImp.provider}`;
        const current =
          vt.get(key) ||
          ({
            source: bestImp.source,
            channel: bestImp.channel,
            provider: bestImp.provider,
            revenue: 0,
            orders: 0,
          } as any);
        current.revenue += order.totalAmount;
        current.orders += 1;
        vt.set(key, current);
      }
    }
  }

  // Combine and calculate percentages
  const combined = new Map<string, ViewThroughAttribution>();

  // Add view-through
  for (const [key, data] of vt) {
    combined.set(key, {
      ...data,
      viewThroughRevenue: data.revenue,
      viewThroughOrders: data.orders,
      clickThroughRevenue: 0,
      clickThroughOrders: 0,
      totalRevenue: data.revenue,
      totalOrders: data.orders,
      vt_pct: 100,
    });
  }

  // Add click-through (and merge with view-through if same channel)
  for (const [key, data] of ct) {
    const existing = combined.get(key);
    if (existing) {
      existing.clickThroughRevenue = data.revenue;
      existing.clickThroughOrders = data.orders;
      existing.totalRevenue += data.revenue;
      existing.totalOrders += data.orders;
      existing.vt_pct =
        existing.totalRevenue > 0 ? Math.round((existing.viewThroughRevenue / existing.totalRevenue) * 100) : 0;
    } else {
      combined.set(key, {
        ...data,
        viewThroughRevenue: 0,
        viewThroughOrders: 0,
        clickThroughRevenue: data.revenue,
        clickThroughOrders: data.orders,
        totalRevenue: data.revenue,
        totalOrders: data.orders,
        vt_pct: 0,
      });
    }
  }

  return Array.from(combined.values()).sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0));
}
