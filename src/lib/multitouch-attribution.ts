import { and, eq, lte, gte, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db/client";

export type AttributionModel = "first_touch" | "last_touch" | "linear";

export type Touchpoint = {
  channel: string | null;
  startedAt: Date;
};

export type AttributedRevenue = {
  channel: string | null;
  revenue: number;
  weight: number;
};

export async function getTouchpoints(
  siteId: string,
  visitorId: string,
  beforeDate: Date,
): Promise<Touchpoint[]> {
  const db = await getDb();
  const sessions = await db.query.sessions.findMany({
    where: and(eq(schema.sessions.siteId, siteId), eq(schema.sessions.visitorId, visitorId), lte(schema.sessions.startedAt, beforeDate)),
    columns: { channel: true, startedAt: true },
    orderBy: (s) => s.startedAt,
  });
  return sessions.map((s) => ({ channel: s.channel, startedAt: s.startedAt }));
}

export function attributeOrder(
  totalRevenue: number,
  touchpoints: Touchpoint[],
  model: AttributionModel,
): AttributedRevenue[] {
  if (touchpoints.length === 0) {
    return [];
  }

  const attribution = new Map<string | null, number>();

  if (model === "first_touch") {
    attribution.set(touchpoints[0].channel, totalRevenue);
  } else if (model === "last_touch") {
    attribution.set(touchpoints[touchpoints.length - 1].channel, totalRevenue);
  } else if (model === "linear") {
    const share = totalRevenue / touchpoints.length;
    for (const tp of touchpoints) {
      attribution.set(tp.channel, (attribution.get(tp.channel) ?? 0) + share);
    }
  }

  return Array.from(attribution.entries()).map(([channel, revenue]) => ({
    channel,
    revenue: Math.round(revenue),
    weight: totalRevenue > 0 ? revenue / totalRevenue : 0,
  }));
}

export async function getAssistedConversions(
  siteId: string,
  days: number,
): Promise<
  Array<{
    source: string | null;
    lastTouchRevenue: number;
    assistedRevenue: number;
    assists: number;
    totalRevenue: number;
  }>
> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const orders = await db
    .select({
      id: schema.orders.id,
      visitorId: schema.orders.visitorId,
      totalAmount: schema.orders.totalAmount,
      attributedSource: schema.orders.attributedSource,
      placedAt: schema.orders.placedAt,
    })
    .from(schema.orders)
    .where(and(eq(schema.orders.siteId, siteId), gte(schema.orders.placedAt, cutoff)));

  const visitorIds = [...new Set(orders.map((o) => o.visitorId).filter(Boolean) as string[])];
  if (visitorIds.length === 0) {
    return [];
  }

  const allSessions = await db
    .select({
      visitorId: schema.sessions.visitorId,
      channel: schema.sessions.channel,
      startedAt: schema.sessions.startedAt,
    })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.siteId, siteId), inArray(schema.sessions.visitorId, visitorIds)));

  const sessionsByVisitor = new Map<string, Touchpoint[]>();
  for (const sess of allSessions) {
    const list = sessionsByVisitor.get(sess.visitorId) || [];
    list.push({ channel: sess.channel, startedAt: sess.startedAt });
    sessionsByVisitor.set(sess.visitorId, list);
  }

  for (const list of sessionsByVisitor.values()) {
    list.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  }

  const result = new Map<
    string | null,
    { lastTouchRevenue: number; assistedRevenue: number; assists: number }
  >();

  for (const order of orders) {
    if (!order.visitorId) continue;

    const touchpoints = sessionsByVisitor.get(order.visitorId) || [];
    const lastTouch = touchpoints[touchpoints.length - 1];

    if (lastTouch?.channel === order.attributedSource) {
      const entry = result.get(order.attributedSource) || {
        lastTouchRevenue: 0,
        assistedRevenue: 0,
        assists: 0,
      };
      entry.lastTouchRevenue += order.totalAmount;
      result.set(order.attributedSource, entry);
    }

    for (let i = 0; i < touchpoints.length - 1; i++) {
      const assistingChannel = touchpoints[i].channel;
      const entry = result.get(assistingChannel) || {
        lastTouchRevenue: 0,
        assistedRevenue: 0,
        assists: 0,
      };
      entry.assistedRevenue += order.totalAmount;
      entry.assists += 1;
      result.set(assistingChannel, entry);
    }
  }

  return Array.from(result.entries()).map(([source, metrics]) => ({
    source,
    ...metrics,
    totalRevenue: metrics.lastTouchRevenue + metrics.assistedRevenue,
  }));
}
